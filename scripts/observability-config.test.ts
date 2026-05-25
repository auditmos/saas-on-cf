import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

function parseJsonc(source: string): unknown {
	const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
	const withoutLineComments = withoutBlockComments.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
	const withoutTrailingCommas = withoutLineComments.replace(/,(\s*[}\]])/g, "$1");
	return JSON.parse(withoutTrailingCommas);
}

function isRateInRange(value: unknown): boolean {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

const files = findWranglerFiles(repoRoot);

describe("wrangler.jsonc observability sampling config", () => {
	it("finds at least one wrangler.jsonc file", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	for (const file of files) {
		const relative = file.slice(repoRoot.length + 1);

		describe(relative, () => {
			const config = parseJsonc(readFileSync(file, "utf8")) as {
				observability?: {
					enabled?: unknown;
					logs?: { head_sampling_rate?: unknown };
					traces?: { enabled?: unknown; head_sampling_rate?: unknown };
				};
			};
			const obs = config.observability;

			it("has observability.enabled === true", () => {
				expect(obs?.enabled, `${relative} missing observability.enabled`).toBe(true);
			});

			it("has observability.logs.head_sampling_rate in [0, 1]", () => {
				expect(
					isRateInRange(obs?.logs?.head_sampling_rate),
					`${relative} observability.logs.head_sampling_rate must be a number in [0,1]`,
				).toBe(true);
			});

			it("has observability.traces.enabled === true", () => {
				expect(obs?.traces?.enabled, `${relative} missing observability.traces.enabled`).toBe(true);
			});

			it("has observability.traces.head_sampling_rate in [0, 1]", () => {
				expect(
					isRateInRange(obs?.traces?.head_sampling_rate),
					`${relative} observability.traces.head_sampling_rate must be a number in [0,1]`,
				).toBe(true);
			});
		});
	}
});
