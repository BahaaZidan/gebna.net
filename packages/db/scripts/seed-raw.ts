import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { desc, eq, inArray } from "drizzle-orm";

import { dbSchema, getDB, type DBInstance } from "../src/index.js";

const PORT = 5191;
const EMAIL_TO_SWAP = "gebnatorky@gmail.com";
const EMAIL_REPLACEMENT = "bob@gebna.test";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const RAW_EMAILS_DIR = path.join(__dirname, "data", "lolo");
const RAW_EMAILS_DIR = path.join(__dirname, "data", "raw-emails");

type EnvelopeAddrs = { from: string; to: string };

function parseArgs() {
	const args = process.argv.slice(2).filter((arg) => arg !== "--" && arg !== "-");
	const shouldReset = args.includes("reset") || args.includes("--reset") || args.includes("-r");
	const shouldClear = args.includes("clear") || args.includes("--clear") || args.includes("-c");

	if (shouldReset && shouldClear) {
		throw new Error("Use either reset or clear, not both. \n");
	}

	return { shouldReset, shouldClear };
}

function extractHeaderValue(header: string, raw: string): string | undefined {
	const match = raw.match(
		new RegExp(`^${header}:\\s*([^\\r\\n]*(?:\\r?\\n[ \\t]+[^\\r\\n]*)*)`, "im")
	);
	if (!match) return;
	return match[1]?.replace(/\r?\n[ \t]+/g, " ").trim();
}

function extractAddress(header: string, raw: string): string | undefined {
	const value = extractHeaderValue(header, raw);
	if (!value) return;
	const bracketMatch = value?.match(/<([^>]+)>/);
	if (bracketMatch) return bracketMatch[1];
	const token = value?.split(/\s+/).at(-1);
	return token?.replace(/^[<"]?|[>"]?$/g, "") || undefined;
}

function extractMessageIdsFromValue(value?: string | null): string[] {
	if (!value) return [];

	const out: string[] = [];
	const seen = new Set<string>();
	const matches = value.match(/<[^<>\s]+>/g) ?? [];

	for (const match of matches) {
		const id = match.trim();
		if (!id.includes("@")) continue;
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}

	return out;
}

function extractMessageIds(raw: string): string[] {
	const value = extractHeaderValue("Message-ID", raw);
	return extractMessageIdsFromValue(value);
}

function buildPayload(raw: string) {
	return raw.includes(EMAIL_TO_SWAP) || raw.includes(EMAIL_REPLACEMENT)
		? raw.replaceAll(EMAIL_TO_SWAP, EMAIL_REPLACEMENT)
		: raw;
}

async function sendEmail(payload: string, filename: string, envelope: EnvelopeAddrs) {
	return new Promise<void>((resolve, reject) => {
		const curl = spawn(
			"curl",
			[
				"-sS",
				"-X",
				"POST",
				`http://localhost:${PORT}/cdn-cgi/handler/email`,
				"--url-query",
				`from=${envelope.from}`,
				"--url-query",
				`to=${envelope.to}`,
				"-H",
				"Content-Type: application/json",
				"--data-binary",
				"@-",
			],
			{
				stdio: ["pipe", "inherit", "inherit"],
			}
		);

		curl.stdin.write(payload);
		curl.stdin.end();

		curl.on("exit", (code) => {
			if (code === 0) return resolve();
			reject(new Error(`curl exited with code ${code ?? "unknown"} for ${filename} \n`));
		});
		curl.on("error", reject);
	});
}

async function resetSeededEmails(
	db: DBInstance,
	payloads: Array<{ file: string; payload: string }>
) {
	const { ids, missingIds } = collectSeededMessageIds(payloads);

	if (!ids.length) {
		console.log("No Message-ID headers found in raw emails. Skipping reset. \n");
		if (missingIds.length) {
			console.log(`Missing Message-ID in: ${missingIds.join(", ")} \n`);
		}
		return;
	}

	const existing = await db
		.select({
			id: dbSchema.emailMessages.id,
			conversationId: dbSchema.emailMessages.conversationId,
		})
		.from(dbSchema.emailMessages)
		.where(inArray(dbSchema.emailMessages.canonicalMessageId, ids));

	if (!existing.length) {
		console.log("No matching seeded emails found to reset. \n");
		return;
	}

	const conversationIds = Array.from(new Set(existing.map((row) => row.conversationId)));

	console.log(`Resetting ${existing.length} seeded emails... \n`);

	await db.transaction(async (tx) => {
		await tx
			.delete(dbSchema.emailMessages)
			.where(inArray(dbSchema.emailMessages.canonicalMessageId, ids));

		if (!conversationIds.length) return;

		const remaining = await tx
			.select({ conversationId: dbSchema.emailMessages.conversationId })
			.from(dbSchema.emailMessages)
			.where(inArray(dbSchema.emailMessages.conversationId, conversationIds))
			.groupBy(dbSchema.emailMessages.conversationId);

		const remainingIds = new Set(remaining.map((row) => row.conversationId));
		const emptyConversationIds = conversationIds.filter((id) => !remainingIds.has(id));

		if (emptyConversationIds.length) {
			await tx
				.delete(dbSchema.emailConversations)
				.where(inArray(dbSchema.emailConversations.id, emptyConversationIds));
		}

		for (const conversationId of remainingIds) {
			const [latest] = await tx
				.select({
					id: dbSchema.emailMessages.id,
					createdAt: dbSchema.emailMessages.createdAt,
				})
				.from(dbSchema.emailMessages)
				.where(eq(dbSchema.emailMessages.conversationId, conversationId))
				.orderBy(desc(dbSchema.emailMessages.createdAt))
				.limit(1);

			await tx
				.update(dbSchema.emailConversations)
				.set({
					lastMessageId: latest?.id ?? null,
					lastMessageAt: latest?.createdAt ?? null,
				})
				.where(eq(dbSchema.emailConversations.id, conversationId));
		}
	});

	if (missingIds.length) {
		console.log(`Skipped reset for files missing Message-ID: ${missingIds.join(", ")} \n`);
	}
}

function collectSeededMessageIds(payloads: Array<{ file: string; payload: string }>) {
	const messageIds = new Set<string>();
	const missingIds: string[] = [];

	for (const { file, payload } of payloads) {
		const ids = extractMessageIds(payload);
		if (!ids.length) {
			missingIds.push(file);
			continue;
		}
		for (const id of ids) messageIds.add(id);
	}

	return { ids: Array.from(messageIds), missingIds };
}

async function clearSeededEmails(
	db: DBInstance,
	payloads: Array<{ file: string; payload: string }>
) {
	const { ids, missingIds } = collectSeededMessageIds(payloads);

	if (!ids.length) {
		console.log("No Message-ID headers found in raw emails. Skipping clear. \n");
		if (missingIds.length) {
			console.log(`Missing Message-ID in: ${missingIds.join(", ")} \n`);
		}
		return;
	}

	const existing = await db
		.select({ id: dbSchema.emailMessages.id })
		.from(dbSchema.emailMessages)
		.where(inArray(dbSchema.emailMessages.canonicalMessageId, ids));

	if (!existing.length) {
		console.log("No matching seeded emails found to clear. \n");
		return;
	}

	console.log(`Clearing ${existing.length} seeded emails... \n`);
	await db
		.delete(dbSchema.emailMessages)
		.where(inArray(dbSchema.emailMessages.canonicalMessageId, ids));

	if (missingIds.length) {
		console.log(`Skipped clear for files missing Message-ID: ${missingIds.join(", ")} \n`);
	}
}

async function main() {
	const { shouldReset, shouldClear } = parseArgs();
	const entries = await readdir(RAW_EMAILS_DIR);
	const files = entries.filter((name) => name.endsWith(".eml")).sort();

	if (!files.length) {
		console.log("No .eml files found to seed. \n");
		return;
	}

	const payloads = await Promise.all(
		files.map(async (file) => {
			const filePath = path.join(RAW_EMAILS_DIR, file);
			const raw = await readFile(filePath, "utf8");
			return { file, payload: buildPayload(raw) };
		})
	);

	if (shouldReset || shouldClear) {
		const url = process.env.TURSO_DATABASE_URL;
		const authToken = process.env.TURSO_AUTH_TOKEN;

		if (!url || !authToken) {
			throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN. \n");
		}

		const db = getDB({ url, authToken });
		if (shouldReset) {
			await resetSeededEmails(db, payloads);
		} else {
			await clearSeededEmails(db, payloads);
			return;
		}
	}

	for (const { file, payload } of payloads) {
		const from = extractAddress("From", payload) ?? "seed@gebna.test";
		const to = extractAddress("To", payload) ?? EMAIL_REPLACEMENT;

		console.log(`\n Seeding ${file}...`);
		await sendEmail(payload, file, { from, to });
	}

	console.log("\n ✅ Done seeding raw emails.");
}

main().catch((error) => {
	console.error(error);
	console.log("\n");
	process.exit(1);
});
