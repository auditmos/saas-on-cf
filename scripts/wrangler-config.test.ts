import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface WranglerConfig {
	env?: Record<string, { vars?: Record<string, string> }>;
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
