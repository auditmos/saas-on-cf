import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface ServiceBinding {
	binding: string;
	service: string;
}

interface WranglerConfig {
	services?: ServiceBinding[];
	env?: Record<string, { vars?: Record<string, string>; services?: ServiceBinding[] }>;
}

const targets = [
	{ name: "data-service", path: "apps/data-service/wrangler.jsonc" },
	{ name: "user-application", path: "apps/user-application/wrangler.jsonc" },
];

describe("wrangler.jsonc CLOUDFLARE_ENV declarations", () => {
	for (const target of targets) {
		it(`${target.name}: every env block declares vars.CLOUDFLARE_ENV matching the env name`, () => {
			const raw = readFileSync(resolve(repoRoot, target.path), "utf8");
			const parsed = JSON.parse(stripJsoncComments(raw)) as WranglerConfig;
			const envs = parsed.env ?? {};
			const envNames = Object.keys(envs);
			expect(envNames.length, `${target.path} declares no env blocks`).toBeGreaterThan(0);
			for (const name of envNames) {
				expect(
					envs[name]?.vars?.CLOUDFLARE_ENV,
					`${target.path} env.${name} must declare vars.CLOUDFLARE_ENV="${name}"`,
				).toBe(name);
			}
		});
	}
});

function readConfig(path: string): WranglerConfig {
	return JSON.parse(stripJsoncComments(readFileSync(resolve(repoRoot, path), "utf8")));
}

/**
 * A service binding names the Worker it talks to, and getting that wrong points
 * one environment's frontend at another's data. A top-level block is the sharp
 * edge: it applies to any deploy that does not select an env — which is exactly
 * the deploy nobody meant to run.
 */
describe("no environment binds another environment's backend", () => {
	for (const target of targets) {
		it(`${target.name}: declares no top-level services block`, () => {
			expect(
				readConfig(target.path).services,
				`${target.path} binds a service outside any env block — an unselected deploy would ship it`,
			).toBeUndefined();
		});

		it(`${target.name}: every env block binds only its own environment's services`, () => {
			const envs = readConfig(target.path).env ?? {};

			for (const [name, block] of Object.entries(envs)) {
				for (const binding of block.services ?? []) {
					expect(
						binding.service.endsWith(`-${name}`),
						`${target.path} env.${name} binds ${binding.binding} to "${binding.service}", which belongs to another environment`,
					).toBe(true);
				}
			}
		});
	}

	it("user-application: every env block binds DATA_SERVICE for itself", () => {
		const envs = readConfig("apps/user-application/wrangler.jsonc").env ?? {};
		const names = Object.keys(envs);
		expect(names.length).toBeGreaterThan(0);

		for (const name of names) {
			const bound = (envs[name]?.services ?? []).find((s) => s.binding === "DATA_SERVICE");
			expect(
				bound?.service,
				`env.${name} must bind DATA_SERVICE itself — there is no top-level block left to fall back to`,
			).toBe(`saas-on-cf-ds-${name}`);
		}
	});
});

/**
 * The guardrail above only holds if nothing can deploy without choosing an
 * environment. A script that runs `wrangler deploy` bare is that hole: it is
 * the shortest command in the file and the one someone reaches for first.
 */
describe("no script can deploy without choosing an environment", () => {
	const manifests = [
		"package.json",
		"apps/data-service/package.json",
		"apps/user-application/package.json",
		"packages/data-ops/package.json",
	];

	for (const manifest of manifests) {
		it(`${manifest}: every wrangler deploy selects an env`, () => {
			const { scripts = {} } = JSON.parse(readFileSync(resolve(repoRoot, manifest), "utf8")) as {
				scripts?: Record<string, string>;
			};

			for (const [name, command] of Object.entries(scripts)) {
				if (!/\bwrangler deploy\b/.test(command)) continue;
				expect(
					/\bwrangler deploy\b[^&|]*--env(=|\s)/.test(command),
					`${manifest} script "${name}" runs wrangler deploy with no --env — it would ship whatever the top level happens to say`,
				).toBe(true);
			}
		});
	}
});
