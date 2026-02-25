import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 5191;
const EMAIL_TO_SWAP = "gebnatorky@gmail.com";
const EMAIL_REPLACEMENT = "bob@gebna.test";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_EMAILS_DIR = path.join(__dirname, "data", "raw-emails");

type EnvelopeAddrs = { from: string; to: string };

function extractAddress(header: string, raw: string): string | undefined {
	const match = raw.match(new RegExp(`^${header}:\\s*(.+)$`, "im"));
	if (!match) return;
	const value = match[1]?.trim();
	const bracketMatch = value?.match(/<([^>]+)>/);
	if (bracketMatch) return bracketMatch[1];
	const token = value?.split(/\s+/).at(-1);
	return token?.replace(/^[<"]?|[>"]?$/g, "") || undefined;
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
			reject(new Error(`curl exited with code ${code ?? "unknown"} for ${filename}`));
		});
		curl.on("error", reject);
	});
}

async function main() {
	const entries = await readdir(RAW_EMAILS_DIR);
	const files = entries.filter((name) => name.endsWith(".eml")).sort();

	if (!files.length) {
		console.log("No .eml files found to seed.");
		return;
	}

	for (const file of files) {
		const filePath = path.join(RAW_EMAILS_DIR, file);
		const raw = await readFile(filePath, "utf8");
		const payload =
			raw.includes(EMAIL_TO_SWAP) || raw.includes(EMAIL_REPLACEMENT)
				? raw.replaceAll(EMAIL_TO_SWAP, EMAIL_REPLACEMENT)
				: raw;

		const from = extractAddress("From", payload) ?? "seed@gebna.test";
		const to = extractAddress("To", payload) ?? EMAIL_REPLACEMENT;

		console.log(`Seeding ${file}...`);
		await sendEmail(payload, file, { from, to });
	}

	console.log("✅ Done seeding raw emails.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
