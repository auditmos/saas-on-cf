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

/**
 * A stack trace nobody can read is not observability. `upload_source_maps` is
 * inheritable, so the top-level declaration is the one that does the work — but
 * an env block that overrides it silently loses its traces, and an env block
 * added later inherits nothing anybody thought about. Asserting it everywhere
 * is what stops that from happening quietly.
 */
describe("wrangler.jsonc source-map upload", () => {
	for (const file of files) {
		const relative = file.slice(repoRoot.length + 1);

		describe(relative, () => {
			const config = parseJsonc(readFileSync(file, "utf8")) as {
				upload_source_maps?: unknown;
				env?: Record<string, { upload_source_maps?: unknown }>;
			};

			it("uploads source maps at the top level", () => {
				expect(
					config.upload_source_maps,
					`${relative} must set upload_source_maps: true — without it every deployed stack trace is minified`,
				).toBe(true);
			});

			it("uploads source maps in every env block", () => {
				const envs = config.env ?? {};
				const names = Object.keys(envs);
				expect(names.length, `${relative} declares no env blocks`).toBeGreaterThan(0);

				for (const name of names) {
					expect(
						envs[name]?.upload_source_maps,
						`${relative} env.${name} must set upload_source_maps: true`,
					).toBe(true);
				}
			});
		});
	}
});

/**
 * The frontend Worker is bundled by Vite, which emits no source map unless asked
 * — so `upload_source_maps` alone would upload nothing there and the traces
 * would stay minified anyway. Server bundle only: a map beside the client bundle
 * is published, and publishing the sources is a different decision entirely.
 */
describe("the frontend build emits the map its Worker uploads", () => {
	const viteConfig = readFileSync(
		resolve(repoRoot, "apps/user-application/vite.config.ts"),
		"utf8",
	).replace(/\s+/g, "");

	it("enables source maps for the server bundle", () => {
		expect(
			/environments:\{[^}]*ssr:\{build:\{[^}]*sourcemap:true/.test(viteConfig),
			"apps/user-application/vite.config.ts must set environments.ssr.build.sourcemap = true",
		).toBe(true);
	});

	it("does not enable them for the client bundle", () => {
		expect(
			/^build:\{[^}]*sourcemap:true/m.test(viteConfig.replace(/^constconfig=defineConfig\(\{/, "")),
			"a top-level build.sourcemap would publish the client's sources — scope it to the ssr environment",
		).toBe(false);
	});
});
