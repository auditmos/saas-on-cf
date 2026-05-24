import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const PROJECT_ROOT = resolve(import.meta.dirname, "..", "..");
const CLIENT_BUILD_DIR = join(PROJECT_ROOT, "dist", "client");
const MARKER = "vite-api-token-marker-do-not-bundle-xyz12345";

const RUN = process.env.RUN_BUNDLE_TEST === "1";

describe.skipIf(!RUN)("api token bundle isolation", () => {
	beforeAll(() => {
		execSync("pnpm run build", {
			cwd: PROJECT_ROOT,
			env: { ...process.env, VITE_API_TOKEN: MARKER },
			stdio: "inherit",
		});
	}, 300_000);

	it("never embeds VITE_API_TOKEN into the client bundle", () => {
		const matches = grepRecursive(CLIENT_BUILD_DIR, MARKER);
		expect(matches).toEqual([]);
	});
});

function grepRecursive(dir: string, needle: string): string[] {
	const matches: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			matches.push(...grepRecursive(full, needle));
		} else if (entry.isFile()) {
			const content = readFileSync(full, "utf-8");
			if (content.includes(needle)) matches.push(full);
		}
	}
	return matches;
}
