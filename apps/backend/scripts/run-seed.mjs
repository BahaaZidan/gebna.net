import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const [endpoint, ...rest] = process.argv.slice(2);
if (!endpoint) {
	console.error("Usage: node scripts/run-seed.mjs <endpoint> [reset]");
	process.exit(1);
}

const shouldReset = rest.includes("reset");
const baseUrl = process.env.SEED_BASE_URL ?? "http://localhost:5173";

async function post(body) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 120_000);
	try {
		const res = await fetch(`${baseUrl}${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
		}
		return text ? JSON.parse(text) : null;
	} finally {
		clearTimeout(timeout);
	}
}

if (endpoint === "/seed/raw-emails") {
	const fs = await import("node:fs/promises");
	const path = await import("node:path");

	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const seedDir = path.resolve(scriptDir, "../src/lib/seeding/data/raw-emails");
	const localFiles = (await fs.readdir(seedDir)).sort((a, b) => a.localeCompare(b));
	const batchSize = 5;

	let offset = 0;
	let batch = 0;
	let totalFiles = localFiles.length;

	while (offset < totalFiles) {
		const body = { limit: batchSize, offset };
		if (batch === 0 && shouldReset) body.reset = true;

		console.log(`Seeding raw emails batch ${batch + 1} (offset ${offset}/${totalFiles})...`);
		const response = await post(body);
		const counts = response?.result?.counts ?? {};
		totalFiles = Number(counts.totalFiles ?? totalFiles) || totalFiles;
		const processed = Number(counts.filesProcessed ?? 0);

		if (!Number.isFinite(processed) || processed <= 0) {
			throw new Error("Seed endpoint returned no progress; aborting to avoid an infinite loop.");
		}

		offset += processed;
		batch += 1;

		if (offset >= totalFiles) break;

		// small pause to avoid local throttling
		await sleep(200);
	}
} else {
	await post({ reset: shouldReset || undefined });
}
