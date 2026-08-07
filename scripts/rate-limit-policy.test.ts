/**
 * Guardrails for the rate-limit policy.
 *
 * The policy module is only a single source of truth if nothing else states a
 * limit. These assertions are what keep that true: they fail when a threshold
 * reappears at a call site, when a Worker's declared bindings drift from the
 * policy, or when the legacy `unsafe` escape hatch comes back.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
// Source, not the built package: this guardrail must run before anything is built.
import { RATE_LIMIT_POLICY, type WorkerName } from "../packages/data-ops/src/rate-limit/policy";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface RateLimitDeclaration {
	name: string;
	namespace_id: string;
	simple: { limit: number; period: number };
}

interface WranglerConfig {
	unsafe?: unknown;
	ratelimits?: RateLimitDeclaration[];
	env?: Record<string, { unsafe?: unknown; ratelimits?: RateLimitDeclaration[] }>;
}

const workers: { name: WorkerName; dir: string }[] = [
	{ name: "data-service", dir: "apps/data-service" },
	{ name: "user-application", dir: "apps/user-application" },
];

function readWrangler(dir: string): WranglerConfig {
	const raw = readFileSync(resolve(repoRoot, dir, "wrangler.jsonc"), "utf8");
	return JSON.parse(stripJsoncComments(raw)) as WranglerConfig;
}

function sourceFiles(dir: string): string[] {
	const root = resolve(repoRoot, dir, "src");
	const found: string[] = [];

	const walk = (current: string) => {
		for (const entry of readdirSync(current)) {
			if (entry === "node_modules") continue;
			const full = join(current, entry);
			if (statSync(full).isDirectory()) {
				walk(full);
				continue;
			}
			if (!/\.(ts|tsx)$/.test(entry)) continue;
			if (entry.includes(".test.")) continue;
			found.push(full);
		}
	};

	walk(root);
	return found;
}

describe("limits are declared through the first-class configuration field", () => {
	for (const worker of workers) {
		it(`${worker.name}: declares a ratelimits block in every env`, () => {
			const config = readWrangler(worker.dir);
			const envNames = Object.keys(config.env ?? {});

			expect(envNames.length).toBeGreaterThan(0);
			for (const name of envNames) {
				expect(
					config.env?.[name]?.ratelimits,
					`${worker.dir} env.${name} declares no ratelimits`,
				).toBeDefined();
			}
		});

		it(`${worker.name}: does not use the legacy unsafe escape hatch`, () => {
			const config = readWrangler(worker.dir);

			expect(config.unsafe, `${worker.dir} declares a top-level unsafe block`).toBeUndefined();
			for (const [name, block] of Object.entries(config.env ?? {})) {
				expect(block.unsafe, `${worker.dir} env.${name} declares an unsafe block`).toBeUndefined();
			}
		});

		it(`${worker.name}: every declared limiter matches the policy`, () => {
			const config = readWrangler(worker.dir);
			const expected = RATE_LIMIT_POLICY.filter((rule) => rule.worker === worker.name);
			const blocks = [
				...(config.ratelimits ? [{ env: "<top-level>", entries: config.ratelimits }] : []),
				...Object.entries(config.env ?? {}).map(([env, block]) => ({
					env,
					entries: block.ratelimits ?? [],
				})),
			];

			for (const block of blocks) {
				const byName = new Map(block.entries.map((entry) => [entry.name, entry]));

				for (const rule of expected) {
					const declared = byName.get(rule.binding);
					expect(
						declared,
						`${worker.dir} env.${block.env} is missing "${rule.binding}" for rule ${rule.id}`,
					).toBeDefined();
					expect(
						declared?.simple,
						`${worker.dir} env.${block.env} "${rule.binding}" disagrees with rule ${rule.id}`,
					).toEqual({ limit: rule.limit, period: rule.period });
				}

				for (const entry of block.entries) {
					expect(
						expected.some((rule) => rule.binding === entry.name),
						`${worker.dir} env.${block.env} declares "${entry.name}", which no policy rule uses`,
					).toBe(true);
				}
			}
		});

		it(`${worker.name}: gives every limiter its own namespace`, () => {
			const config = readWrangler(worker.dir);
			for (const [env, block] of Object.entries(config.env ?? {})) {
				const ids = (block.ratelimits ?? []).map((entry) => entry.namespace_id);
				expect(new Set(ids).size, `${worker.dir} env.${env} reuses a namespace_id`).toBe(
					ids.length,
				);
			}
		});
	}
});

describe("no rate-limit threshold appears at a call site", () => {
	/** `limit: 10`, `period = 60`, `window: 30` — a number where a policy reference belongs. */
	const THRESHOLD = /\b(limit|period|window)\s*[:=]\s*\d+/;

	const thresholdsIn = (file: string): string[] =>
		readFileSync(file, "utf8")
			.split("\n")
			.map((line, index) => ({ line, number: index + 1 }))
			.filter(({ line }) => THRESHOLD.test(line.replace(/\/\/.*$/, "")))
			.map(({ line, number }) => `${file.slice(repoRoot.length + 1)}:${number} — ${line.trim()}`);

	const mentionsRateLimiting = (file: string): boolean =>
		/rateLimit|RATE_LIMIT|RATE_LIMITER/i.test(readFileSync(file, "utf8"));

	for (const worker of workers) {
		it(`${worker.name}: states no threshold in any rate-limit-aware source file`, () => {
			const offenders = sourceFiles(worker.dir).filter(mentionsRateLimiting).flatMap(thresholdsIn);

			expect(offenders, "thresholds belong in RATE_LIMIT_POLICY, not at call sites").toEqual([]);
		});
	}

	it("the policy is the only place a threshold is written", () => {
		const policy = readFileSync(
			resolve(repoRoot, "packages/data-ops/src/rate-limit/policy.ts"),
			"utf8",
		);

		expect(THRESHOLD.test(policy)).toBe(true);
	});

	it("every rule the policy declares is bound to a Worker this repo ships", () => {
		const names = new Set(workers.map((worker) => worker.name));

		for (const rule of RATE_LIMIT_POLICY) {
			expect(names.has(rule.worker), `rule ${rule.id} targets unknown worker`).toBe(true);
		}
	});

	it("gives every rule a distinct id, so budgets cannot collide", () => {
		const ids = RATE_LIMIT_POLICY.map((rule) => rule.id);

		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("generated environment types reflect the limiter bindings", () => {
	for (const worker of workers) {
		it(`${worker.name}: types every policy binding as RateLimit`, () => {
			const generated = readFileSync(
				resolve(repoRoot, worker.dir, "worker-configuration.d.ts"),
				"utf8",
			);

			for (const rule of RATE_LIMIT_POLICY.filter((r) => r.worker === worker.name)) {
				expect(
					generated,
					`${worker.dir}/worker-configuration.d.ts is stale — run \`pnpm --filter ${worker.name} cf-typegen\``,
				).toContain(`${rule.binding}: RateLimit;`);
			}
		});
	}
});
