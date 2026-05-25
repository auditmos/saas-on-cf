import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyRouteConfig } from "./init-project";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const DATA_SERVICE_WRANGLER = resolve(repoRoot, "apps/data-service/wrangler.jsonc");
const USER_APP_WRANGLER = resolve(repoRoot, "apps/user-application/wrangler.jsonc");

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function stripTrailingCommas(text: string): string {
	return text.replace(/,(\s*[}\]])/g, "$1");
}

function parseJsonc<T = unknown>(text: string): T {
	return JSON.parse(stripTrailingCommas(stripJsoncComments(text))) as T;
}

interface WranglerShape {
	env: {
		staging: { routes?: Array<{ pattern: string; custom_domain: boolean }> };
		production: { routes?: Array<{ pattern: string; custom_domain: boolean }> };
	};
}

describe("applyRouteConfig", () => {
	describe("data-service kind", () => {
		it("uncomments and wires staging + production routes from the template", () => {
			const original = readFileSync(DATA_SERVICE_WRANGLER, "utf-8");

			const result = applyRouteConfig(
				original,
				{ domain: "example.com", stagingPrefix: "staging" },
				"data-service",
			);
			const parsed = parseJsonc<WranglerShape>(result);

			expect(parsed.env.staging.routes).toEqual([
				{ pattern: "api-staging.example.com", custom_domain: true },
			]);
			expect(parsed.env.production.routes).toEqual([
				{ pattern: "api.example.com", custom_domain: true },
			]);
		});
	});

	describe("user-application kind", () => {
		it("uncomments and wires staging + production routes from the template", () => {
			const original = readFileSync(USER_APP_WRANGLER, "utf-8");

			const result = applyRouteConfig(
				original,
				{ domain: "example.com", stagingPrefix: "staging" },
				"user-application",
			);
			const parsed = parseJsonc<WranglerShape>(result);

			expect(parsed.env.staging.routes).toEqual([
				{ pattern: "staging.example.com", custom_domain: true },
			]);
			expect(parsed.env.production.routes).toEqual([
				{ pattern: "example.com", custom_domain: true },
			]);
		});
	});

	describe("idempotency", () => {
		it("data-service: second run with same config produces identical output", () => {
			const original = readFileSync(DATA_SERVICE_WRANGLER, "utf-8");
			const config = { domain: "example.com", stagingPrefix: "staging" };

			const firstRun = applyRouteConfig(original, config, "data-service");
			const secondRun = applyRouteConfig(firstRun, config, "data-service");

			expect(secondRun).toBe(firstRun);
		});

		it("user-application: second run with same config produces identical output", () => {
			const original = readFileSync(USER_APP_WRANGLER, "utf-8");
			const config = { domain: "example.com", stagingPrefix: "staging" };

			const firstRun = applyRouteConfig(original, config, "user-application");
			const secondRun = applyRouteConfig(firstRun, config, "user-application");

			expect(secondRun).toBe(firstRun);
		});
	});

	describe("update", () => {
		it("re-running with a different domain overwrites previous routes", () => {
			const original = readFileSync(DATA_SERVICE_WRANGLER, "utf-8");

			const first = applyRouteConfig(
				original,
				{ domain: "first.com", stagingPrefix: "staging" },
				"data-service",
			);
			const second = applyRouteConfig(
				first,
				{ domain: "second.com", stagingPrefix: "dev" },
				"data-service",
			);
			const parsed = parseJsonc<WranglerShape>(second);

			expect(parsed.env.staging.routes).toEqual([
				{ pattern: "api-dev.second.com", custom_domain: true },
			]);
			expect(parsed.env.production.routes).toEqual([
				{ pattern: "api.second.com", custom_domain: true },
			]);
			expect(second).not.toContain("first.com");
		});
	});
});

describe("init-project CLI", () => {
	const tsxBin = resolve(repoRoot, "node_modules/.bin/tsx");
	const scriptPath = resolve(repoRoot, "scripts/init-project.ts");

	function setupTempRoot(): string {
		const tmp = mkdtempSync(join(tmpdir(), "init-project-test-"));
		mkdirSync(join(tmp, "apps/data-service"), { recursive: true });
		mkdirSync(join(tmp, "apps/user-application"), { recursive: true });
		copyFileSync(DATA_SERVICE_WRANGLER, join(tmp, "apps/data-service/wrangler.jsonc"));
		copyFileSync(USER_APP_WRANGLER, join(tmp, "apps/user-application/wrangler.jsonc"));
		writeFileSync(
			join(tmp, "package.json"),
			`${JSON.stringify({ name: "saas-on-cf" }, null, "\t")}\n`,
		);
		return tmp;
	}

	it("--non-interactive: wires routes in both wrangler files", () => {
		const tmp = setupTempRoot();

		execFileSync(
			tsxBin,
			[
				scriptPath,
				"--name",
				"my-app",
				"--domain",
				"example.com",
				"--staging-prefix",
				"staging",
				"--non-interactive",
			],
			{
				env: { ...process.env, INIT_PROJECT_ROOT: tmp },
				stdio: "pipe",
			},
		);

		const ds = parseJsonc<WranglerShape>(
			readFileSync(join(tmp, "apps/data-service/wrangler.jsonc"), "utf-8"),
		);
		const ua = parseJsonc<WranglerShape>(
			readFileSync(join(tmp, "apps/user-application/wrangler.jsonc"), "utf-8"),
		);

		expect(ds.env.staging.routes).toEqual([
			{ pattern: "api-staging.example.com", custom_domain: true },
		]);
		expect(ds.env.production.routes).toEqual([{ pattern: "api.example.com", custom_domain: true }]);
		expect(ua.env.staging.routes).toEqual([
			{ pattern: "staging.example.com", custom_domain: true },
		]);
		expect(ua.env.production.routes).toEqual([{ pattern: "example.com", custom_domain: true }]);
	});

	it("re-running on an already-initialized project leaves files unchanged", () => {
		const tmp = setupTempRoot();
		const cliArgs = [
			scriptPath,
			"--name",
			"my-app",
			"--domain",
			"example.com",
			"--staging-prefix",
			"staging",
			"--non-interactive",
		];
		const env = { ...process.env, INIT_PROJECT_ROOT: tmp };

		execFileSync(tsxBin, cliArgs, { env, stdio: "pipe" });
		const afterFirst = readFileSync(join(tmp, "apps/data-service/wrangler.jsonc"), "utf-8");

		execFileSync(tsxBin, cliArgs, { env, stdio: "pipe" });
		const afterSecond = readFileSync(join(tmp, "apps/data-service/wrangler.jsonc"), "utf-8");

		expect(afterSecond).toBe(afterFirst);
	});
});
