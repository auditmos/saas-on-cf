import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const THRESHOLD_DAYS = 90;
const MS_PER_DAY = 86_400_000;
const DATE_FIELD_RE = /"compatibility_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/;
const SKIP_DIRS = new Set(["node_modules", ".wrangler", ".git", "dist", ".turbo", "coverage"]);

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function findWranglerFiles(dir: string, results: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			findWranglerFiles(full, results);
		} else if (entry.name === "wrangler.jsonc") {
			results.push(full);
		}
	}
	return results;
}

const files = findWranglerFiles(repoRoot);

describe("wrangler.jsonc compatibility_date freshness", () => {
	it("finds at least one wrangler.jsonc file", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	for (const file of files) {
		const relative = file.slice(repoRoot.length + 1);
		it(`${relative} has compatibility_date within ${THRESHOLD_DAYS} days`, () => {
			const content = readFileSync(file, "utf8");
			const match = content.match(DATE_FIELD_RE);
			const dateStr = match?.[1];
			expect(dateStr, `no compatibility_date field in ${relative}`).toBeDefined();
			if (!dateStr) return;
			const parsed = Date.parse(dateStr);
			expect(Number.isNaN(parsed), `unparseable compatibility_date in ${relative}`).toBe(false);
			const ageDays = (Date.now() - parsed) / MS_PER_DAY;
			expect(
				ageDays,
				`${relative} compatibility_date is ${Math.floor(ageDays)}d old (threshold ${THRESHOLD_DAYS}d) — run \`pnpm tsx scripts/bump-stale-compat-dates.ts\` to bump`,
			).toBeLessThanOrEqual(THRESHOLD_DAYS);
		});
	}
});
