import { spawnSync } from "node:child_process";

const [endpoint, ...rest] = process.argv.slice(2);
if (!endpoint) {
	console.error("Usage: node scripts/run-seed.mjs <endpoint> [reset]");
	process.exit(1);
}

const shouldReset = rest.includes("reset");
const baseUrl = process.env.SEED_BASE_URL ?? "http://localhost:5173";

const args = ["-fsS", "-X", "POST", "-H", "Content-Type: application/json"];
if (shouldReset) args.push("-d", '{"reset":true}');
args.push(`${baseUrl}${endpoint}`);

const result = spawnSync("curl", args, { stdio: "inherit" });
process.exit(result.status ?? 0);
