import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

type SupportedKind = "image" | "pdf" | "office" | "video";

const PORT = Number(process.env.PORT ?? "8787");
const SECRET_ENV = process.env.BACKGROUND_SECRET ?? "";

const SECRET_HEADER = "x-background-secret";
const FILENAME_HEADER = "x-filename"; // optional but strongly recommended
const MIME_HEADER = "x-mime-type"; // optional (if you can’t rely on Content-Type)

const MAX_BODY_BYTES = 30 * 1024 * 1024; // 30MB safeguard (adjust if needed)

const THUMB_MAX_W = 512;
const THUMB_MAX_H = 512;
const WEBP_QUALITY = 80;

const OFFICE_EXTS = new Set([
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"odt",
	"ods",
	"odp",
	"rtf",
]);

const VIDEO_MIME_PREFIXES = ["video/"];
const VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v", "3gp"]);

function header(req: http.IncomingMessage, name: string): string | null {
	const v = req.headers[name.toLowerCase()];
	if (typeof v === "string") return v;
	if (Array.isArray(v)) return v[0] ?? null;
	return null;
}

function jsonNull(res: http.ServerResponse, status = 200): void {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end("null");
}

function forbidden(res: http.ServerResponse): void {
	res.statusCode = 403;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify({ error: "forbidden" }));
}

function badRequest(res: http.ServerResponse, msg: string): void {
	res.statusCode = 400;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify({ error: msg }));
}

function getExtFromFilename(filename: string | null): string | null {
	if (!filename) return null;
	const ext = path.extname(filename).toLowerCase().replace(/^\./, "");
	return ext || null;
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
	return await new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;

		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > MAX_BODY_BYTES) {
				reject(new Error("Body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});

		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}

function detectKind(params: {
	contentType: string | null;
	providedMime: string | null;
	ext: string | null;
	detectedMime: string | null;
}): SupportedKind | null {
	const mime = (
		params.providedMime?.trim() ||
		params.contentType?.trim() ||
		params.detectedMime?.trim() ||
		""
	).toLowerCase();

	const ext = (params.ext || "").toLowerCase();

	if (mime.startsWith("image/")) return "image";
	if (mime === "application/pdf") return "pdf";

	if (VIDEO_MIME_PREFIXES.some((p) => mime.startsWith(p))) return "video";
	if (VIDEO_EXTS.has(ext)) return "video";

	// Office-ish (often comes as application/octet-stream from clients)
	if (OFFICE_EXTS.has(ext)) return "office";

	// Some common office mimes (not exhaustive; extension is still preferred)
	if (
		mime.includes("officedocument") ||
		mime.includes("msword") ||
		mime.includes("mspowerpoint") ||
		mime.includes("msexcel") ||
		mime.includes("vnd.ms-") ||
		mime.includes("vnd.oasis.opendocument")
	) {
		return "office";
	}

	return null;
}

async function runCommand(
	cmd: string,
	args: string[],
	opts: { cwd: string; timeoutMs: number }
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: opts.cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString("utf8");
			if (stderr.length > 50_000) stderr = stderr.slice(-50_000);
		});

		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error(`${cmd} timed out`));
		}, opts.timeoutMs);

		child.on("error", (err) => {
			clearTimeout(timeout);
			reject(err);
		});

		child.on("close", (code) => {
			clearTimeout(timeout);
			if (code === 0) return resolve();
			reject(new Error(`${cmd} failed with code ${code}: ${stderr}`));
		});
	});
}

async function ensureDir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

async function createTempDir(): Promise<string> {
	const dir = path.join(os.tmpdir(), `thumb-${randomUUID()}`);
	await ensureDir(dir);
	return dir;
}

/**
 * Produces an image buffer (PNG) from:
 * - pdf: first page
 * - office: convert to pdf first, then first page
 * - video: extract a frame
 */
async function materializePreviewPng(params: {
	kind: Exclude<SupportedKind, "image">;
	inputPath: string;
	workDir: string;
	inputExt: string | null;
}): Promise<string | null> {
	const outPng = path.join(params.workDir, "preview.png");

	try {
		if (params.kind === "pdf") {
			// pdftoppm writes: <prefix>.png when -png is used; -singlefile avoids -1 suffix.
			const prefix = path.join(params.workDir, "preview");
			await runCommand(
				"pdftoppm",
				["-f", "1", "-l", "1", "-singlefile", "-png", params.inputPath, prefix],
				{ cwd: params.workDir, timeoutMs: 20_000 }
			);
			const produced = `${prefix}.png`;
			await fs.access(produced);
			// Normalize to preview.png
			await fs.rename(produced, outPng);
			return outPng;
		}

		if (params.kind === "office") {
			// LibreOffice converts to PDF, then we rasterize page 1 using poppler.
			const outDir = params.workDir;

			// Keep the original extension for LO to guess format.
			// LO writes output with same basename, .pdf extension.
			await runCommand(
				"soffice",
				[
					"--headless",
					"--nologo",
					"--nofirststartwizard",
					"--nodefault",
					"--norestore",
					"--convert-to",
					"pdf",
					"--outdir",
					outDir,
					params.inputPath,
				],
				{ cwd: params.workDir, timeoutMs: 45_000 }
			);

			const base = path.basename(params.inputPath);
			const baseNoExt = base.replace(/\.[^.]+$/, "");
			const producedPdf = path.join(outDir, `${baseNoExt}.pdf`);

			await fs.access(producedPdf);

			// Now rasterize first page
			const prefix = path.join(params.workDir, "preview");
			await runCommand(
				"pdftoppm",
				["-f", "1", "-l", "1", "-singlefile", "-png", producedPdf, prefix],
				{ cwd: params.workDir, timeoutMs: 25_000 }
			);

			const producedPng = `${prefix}.png`;
			await fs.access(producedPng);
			await fs.rename(producedPng, outPng);
			return outPng;
		}

		if (params.kind === "video") {
			// Extract a representative frame around 1s.
			// -loglevel error keeps stderr small; if decode fails -> throw -> null.
			// We output PNG then let sharp handle resize+webp consistently.
			await runCommand(
				"ffmpeg",
				[
					"-hide_banner",
					"-loglevel",
					"error",
					"-ss",
					"00:00:01.000",
					"-i",
					params.inputPath,
					"-frames:v",
					"1",
					"-f",
					"image2",
					outPng,
				],
				{ cwd: params.workDir, timeoutMs: 30_000 }
			);

			await fs.access(outPng);
			return outPng;
		}

		return null;
	} catch {
		return null;
	}
}

async function imageToWebp(buffer: Buffer): Promise<Buffer | null> {
	try {
		// Hardening: strip metadata, normalize orientation, constrain size, encode to webp.
		return await sharp(buffer, { failOn: "none" })
			.rotate()
			.resize({
				width: THUMB_MAX_W,
				height: THUMB_MAX_H,
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({ quality: WEBP_QUALITY })
			.toBuffer();
	} catch {
		return null;
	}
}

async function filePathToWebp(inputImagePath: string): Promise<Buffer | null> {
	try {
		return await sharp(inputImagePath, { failOn: "none" })
			.rotate()
			.resize({
				width: THUMB_MAX_W,
				height: THUMB_MAX_H,
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({ quality: WEBP_QUALITY })
			.toBuffer();
	} catch {
		return null;
	}
}

const server = http.createServer(async (req, res) => {
	try {
		if (req.method !== "POST" || req.url !== "/thumbnail") {
			res.statusCode = 404;
			res.end();
			return;
		}

		// Auth
		const providedSecret = header(req, SECRET_HEADER);
		if (!providedSecret || !SECRET_ENV || providedSecret !== SECRET_ENV) {
			forbidden(res);
			return;
		}

		// Body
		if (!req.headers["content-length"] && req.headers["transfer-encoding"] == null) {
			badRequest(res, "missing body");
			return;
		}

		const contentType = header(req, "content-type");
		const providedMime = header(req, MIME_HEADER);
		const filename = header(req, FILENAME_HEADER);
		const ext = getExtFromFilename(filename);

		const body = await readBody(req);

		// Try sniffing if caller didn’t provide usable metadata.
		const sniff = await fileTypeFromBuffer(body).catch(() => null);
		const detectedMime = sniff?.mime ?? null;

		const kind = detectKind({ contentType, providedMime, ext, detectedMime });
		if (kind == null) {
			jsonNull(res, 200);
			return;
		}

		// If the input is an image, do it purely via sharp.
		if (kind === "image") {
			const webp = await imageToWebp(body);
			if (!webp) {
				jsonNull(res, 200);
				return;
			}
			res.statusCode = 200;
			res.setHeader("content-type", "image/webp");
			res.setHeader("content-length", String(webp.byteLength));
			res.end(webp);
			return;
		}

		// Everything else: write to temp file, run toolchain, then sharp -> webp.
		const workDir = await createTempDir();
		try {
			const inputExt = ext ?? sniff?.ext ?? (kind === "pdf" ? "pdf" : null);
			const inputName = `input${inputExt ? "." + inputExt : ""}`;
			const inputPath = path.join(workDir, inputName);

			await fs.writeFile(inputPath, body);

			const previewPng = await materializePreviewPng({
				kind,
				inputPath,
				workDir,
				inputExt,
			});

			if (!previewPng) {
				jsonNull(res, 200);
				return;
			}

			const webp = await filePathToWebp(previewPng);
			if (!webp) {
				jsonNull(res, 200);
				return;
			}

			res.statusCode = 200;
			res.setHeader("content-type", "image/webp");
			res.setHeader("content-length", String(webp.byteLength));
			res.end(webp);
		} finally {
			// Best-effort cleanup
			// (Cloudflare containers have ephemeral FS, but still avoid buildup)
			// eslint-disable-next-line no-empty
			await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
		}
	} catch {
		// Any failure => null (per your requirement)
		jsonNull(res, 200);
	}
});

server.listen(PORT, "0.0.0.0", () => {
	// Keep logs minimal
	// eslint-disable-next-line no-console
	console.log(`thumbnail service listening on :${PORT}`);
});
