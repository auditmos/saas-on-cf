import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	installedRuntimes,
	newestSupportedDate,
	planBump,
	type Runtime,
	RuntimeLookupError,
} from "./bump-stale-compat-dates";

const TODAY = "2026-11-24";
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function runtime(compatibilityDate: string, tool = "wrangler"): Runtime {
	return { tool, workerd: `1.${compatibilityDate.replaceAll("-", "")}.1`, compatibilityDate };
}

/** A throwaway Worker directory whose node_modules holds the given files. */
function fixture(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "compat-date-"));
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}
	return root;
}

function manifest(name: string, extra: object = {}): string {
	return JSON.stringify({ name, ...extra });
}

describe("planBump", () => {
	it("leaves a date 90 days old alone", () => {
		expect(planBump("2026-08-26", TODAY, TODAY)).toEqual({ kind: "fresh" });
	});

	it("bumps a date 91 days old to today when the runtimes support it", () => {
		expect(planBump("2026-08-25", TODAY, TODAY)).toEqual({
			kind: "bump",
			to: TODAY,
			capped: false,
			stillStale: false,
		});
	});

	it("caps the bump at the newest date the runtimes support", () => {
		expect(planBump("2026-08-01", TODAY, "2026-11-17")).toEqual({
			kind: "bump",
			to: "2026-11-17",
			capped: true,
			stillStale: false,
		});
	});

	it("flags a capped bump that leaves the date stale", () => {
		expect(planBump("2026-01-01", TODAY, "2026-06-01")).toEqual({
			kind: "bump",
			to: "2026-06-01",
			capped: true,
			stillStale: true,
		});
	});

	it("is blocked when the runtimes support nothing newer than the current date", () => {
		expect(planBump("2026-08-01", TODAY, "2026-08-01")).toEqual({ kind: "blocked" });
		expect(planBump("2026-08-01", TODAY, "2026-07-01")).toEqual({ kind: "blocked" });
	});
});

describe("newestSupportedDate", () => {
	it("is the oldest runtime's limit", () => {
		const runtimes = [runtime("2026-11-19"), runtime("2026-11-17", "@cloudflare/vite-plugin")];

		expect(newestSupportedDate(runtimes)).toBe("2026-11-17");
	});

	it("is unknown without a runtime", () => {
		expect(newestSupportedDate([])).toBeUndefined();
	});
});

describe("installedRuntimes", () => {
	// pnpm hoists one copy of every package into node_modules/.pnpm/node_modules,
	// so a walk up from any tool finds *a* workerd. Only declared edges count.
	it("follows declared dependencies through miniflare, not a hoisted workerd", () => {
		const plugin = "node_modules/@cloudflare/vite-plugin";
		const miniflare = `${plugin}/node_modules/miniflare`;
		const worker = fixture({
			"package.json": manifest("worker", { devDependencies: { "@cloudflare/vite-plugin": "1" } }),
			[`${plugin}/package.json`]: manifest("@cloudflare/vite-plugin", {
				dependencies: { miniflare: "5" },
			}),
			[`${miniflare}/package.json`]: manifest("miniflare", { dependencies: { workerd: "1" } }),
			[`${miniflare}/node_modules/workerd/package.json`]: manifest("workerd", { main: "main.js" }),
			[`${miniflare}/node_modules/workerd/main.js`]:
				'module.exports = { compatibilityDate: "2026-11-17", version: "1.20261117.1" };',
			"node_modules/workerd/package.json": manifest("workerd", { main: "main.js" }),
			"node_modules/workerd/main.js":
				'module.exports = { compatibilityDate: "2026-10-01", version: "1.20261001.1" };',
		});

		expect(installedRuntimes(worker)).toEqual([
			{ tool: "@cloudflare/vite-plugin", workerd: "1.20261117.1", compatibilityDate: "2026-11-17" },
		]);
	});

	it("ignores tools the Worker does not declare", () => {
		const worker = fixture({ "package.json": manifest("worker", { dependencies: { hono: "4" } }) });

		expect(installedRuntimes(worker)).toEqual([]);
	});

	it("refuses a declared tool that is not installed", () => {
		const worker = fixture({
			"package.json": manifest("worker", { devDependencies: { wrangler: "4" } }),
		});

		expect(() => installedRuntimes(worker)).toThrow(RuntimeLookupError);
		expect(() => installedRuntimes(worker)).toThrow("wrangler is declared but not installed");
	});

	it("refuses a tool with no workerd behind it, rather than leaving the date uncapped", () => {
		const worker = fixture({
			"package.json": manifest("worker", { devDependencies: { wrangler: "4" } }),
			"node_modules/wrangler/package.json": manifest("wrangler", {
				dependencies: { workerd: "1" },
			}),
		});

		expect(() => installedRuntimes(worker)).toThrow("no workerd found behind wrangler");
	});

	const RUNTIME_TOOLS = ["wrangler", "@cloudflare/vite-plugin", "@cloudflare/vitest-plugin"];
	const workers = readdirSync(join(repoRoot, "apps")).filter((app) =>
		existsSync(join(repoRoot, "apps", app, "wrangler.jsonc")),
	);

	for (const app of workers) {
		it(`apps/${app}: finds a workerd behind every runtime tool it declares`, () => {
			const dir = join(repoRoot, "apps", app);
			const { dependencies = {}, devDependencies = {} } = JSON.parse(
				readFileSync(join(dir, "package.json"), "utf8"),
			) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
			const declared = RUNTIME_TOOLS.filter(
				(tool) => tool in { ...dependencies, ...devDependencies },
			);

			const runtimes = installedRuntimes(dir);

			expect(new Set(runtimes.map((r) => r.tool))).toEqual(new Set(declared));
			for (const found of runtimes) {
				expect(found.compatibilityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			}
		});
	}
});
