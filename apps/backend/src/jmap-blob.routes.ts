import { v } from "@gebna/validation";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { getDB } from "./db";
import { accountBlobTable, blobTable } from "./db/schema";
import { JMAP_CONSTRAINTS, JMAP_CORE } from "./lib/jmap/constants";
import { attachUserFromJwt, JMAPHonoAppEnv, requireJWT } from "./lib/jmap/middlewares";
import { sha256HexFromArrayBuffer } from "./lib/utils";

export const jmapFilesApp = new Hono<JMAPHonoAppEnv>();
jmapFilesApp.use(requireJWT);
jmapFilesApp.use(attachUserFromJwt);

const accountIdSchema = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._-]{1,128}$/));

const postParamsSchema = v.object({
	accountId: accountIdSchema,
	type: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._-]{1,32}$/)),
});

jmapFilesApp.post("/upload/:accountId/:type", async (c) => {
	try {
		const paramsValidation = v.safeParse(postParamsSchema, c.req.param());
		if (!paramsValidation.success)
			return c.json(
				{
					type: "invalidArguments",
					description: paramsValidation.issues,
				},
				400
			);

		if (c.get("accountId") !== paramsValidation.output.accountId)
			return c.json(
				{
					type: "forbidden",
					description: "Account access denied",
				},
				403
			);

		const contentLengthHeader = c.req.header("Content-Length");
		if (contentLengthHeader) {
			const contentLength = Number(contentLengthHeader);
			if (!Number.isFinite(contentLength) || contentLength < 0) {
				return c.json(
					{
						type: "invalidArguments",
						description: "Invalid Content-Length",
					},
					400
				);
			}
			if (contentLength > JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload) {
				return c.json(
					{
						type: "invalidArguments",
						description: "Upload too large",
					},
					413
				);
			}
		}

		const body = await c.req.arrayBuffer();
		if (body.byteLength === 0) {
			return c.json(
				{
					type: "invalidArguments",
					description: "Empty upload",
				},
				400
			);
		}
		if (body.byteLength > JMAP_CONSTRAINTS[JMAP_CORE].maxSizeUpload) {
			return c.json(
				{
					type: "invalidArguments",
					description: "Upload too large",
				},
				413
			);
		}

		const contentType = c.req.header("Content-Type") ?? "application/octet-stream";

		const blobId = await sha256HexFromArrayBuffer(body);
		const key = `blob/${blobId}`;

		await c.env.R2_EMAILS.put(key, body, {
			httpMetadata: {
				contentType,
			},
		});

		const db = getDB(c.env);
		const now = new Date();

		await db.transaction(async (tx) => {
			await tx
				.insert(blobTable)
				.values({
					sha256: blobId,
					size: body.byteLength,
					r2Key: key,
					createdAt: now,
				})
				.onConflictDoUpdate({
					target: blobTable.sha256,
					set: {
						size: body.byteLength,
						r2Key: key,
					},
				});

			await tx
				.insert(accountBlobTable)
				.values({
					accountId: paramsValidation.output.accountId,
					sha256: blobId,
					createdAt: now,
				})
				.onConflictDoNothing();
		});

		return c.json(
			{
				accountId: paramsValidation.output.accountId,
				blobId,
				type: contentType,
				size: body.byteLength,
			},
			201,
			{
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
			}
		);
	} catch (err) {
		console.error({ err });
		return c.json(
			{
				type: "serverError",
				description: "Unexpected error",
			},
			500
		);
	}
});

const getParamsSchema = v.object({
	accountId: accountIdSchema,
	blobId: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
	name: v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._-][a-zA-Z0-9._\-\s]{0,255}$/)),
});

jmapFilesApp.get("/download/:accountId/:blobId/:name", async (c) => {
	try {
		const paramsValidation = v.safeParse(getParamsSchema, c.req.param());
		if (!paramsValidation.success)
			return c.json(
				{
					type: "invalidArguments",
					description: paramsValidation.issues,
				},
				400
			);

		if (c.get("accountId") !== paramsValidation.output.accountId)
			return c.json(
				{
					type: "forbidden",
					description: "Account access denied",
				},
				403
			);

		const db = getDB(c.env);

		const [mapping] = await db
			.select()
			.from(accountBlobTable)
			.where(
				and(
					eq(accountBlobTable.accountId, paramsValidation.output.accountId),
					eq(accountBlobTable.sha256, paramsValidation.output.blobId)
				)
			)
			.limit(1);

		if (!mapping) {
			return c.json(
				{
					type: "notFound",
					description: "Blob not found",
				},
				404
			);
		}

		const [blobRow] = await db
			.select()
			.from(blobTable)
			.where(eq(blobTable.sha256, paramsValidation.output.blobId))
			.limit(1);

		if (!blobRow) {
			return c.json(
				{
					type: "notFound",
					description: "Blob not found",
				},
				404
			);
		}

		const r2Key = blobRow.r2Key ?? `blob/${paramsValidation.output.blobId}`;

		const etag = `"${paramsValidation.output.blobId}"`;
		const ifNoneMatch = c.req.header("If-None-Match");
		if (
			ifNoneMatch &&
			ifNoneMatch
				.split(",")
				.map((v) => v.trim())
				.includes(etag)
		) {
			return new Response(null, {
				status: 304,
				headers: {
					ETag: etag,
					"Cache-Control": "private, max-age=0, must-revalidate",
				},
			});
		}

		const obj = await c.env.R2_EMAILS.get(r2Key);
		if (!obj || !obj.body) {
			return c.json(
				{
					type: "notFound",
					description: "Blob not found",
				},
				404
			);
		}

		return new Response(obj.body, {
			status: 200,
			headers: {
				"Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
				ETag: etag,
				"Cache-Control": "private, max-age=0, must-revalidate",
				"X-Content-Type-Options": "nosniff",
				"Content-Disposition": `attachment; filename="${encodeURIComponent(
					paramsValidation.output.name
				)}"`,
				...(obj.uploaded ? { "Last-Modified": obj.uploaded.toUTCString() } : {}),
			},
		});
	} catch (err) {
		console.error({ err });
		return c.json(
			{
				type: "serverError",
				description: "Unexpected error",
			},
			500
		);
	}
});
