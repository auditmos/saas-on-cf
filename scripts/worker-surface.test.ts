/**
 * Guardrail: a Worker declares only the surface its configuration can trigger.
 *
 * This repository is a public template, so every file in it teaches. A Durable
 * Object nothing binds, a Workflow nothing registers, a `scheduled()` method
 * whose cron sits commented out — each reads as a worked example, and none of
 * them run. The failure is silent: no deploy errors, the handler is simply
 * never called, and a fork learns a pattern that does not work.
 *
 * The rule is therefore symmetrical with `wrangler.jsonc`. If the code declares
 * an event handler, some env must declare the trigger that fires it; if the
 * code defines a platform class, some env must bind it. Deleting the example
 * satisfies the rule and so does wiring it — keeping one side without the other
 * does not.
 *
 * The second half checks the same claim from the dead-code detector's side: an
 * ignore entry is an assertion that a path exists and is deliberately unused.
 * Once the path is gone the entry is a stale exemption, silently widening what
 * knip will not look at.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface ConfigBlock {
	triggers?: { crons?: string[] };
	queues?: { consumers?: unknown[] };
	durable_objects?: { bindings?: unknown[] };
	workflows?: unknown[];
}

interface WranglerConfig extends ConfigBlock {
	main?: string;
	env?: Record<string, ConfigBlock>;
}

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".wrangler", ".turbo", ".cache"]);

function walkFiles(absoluteDir: string): string[] {
	const found: string[] = [];

	for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = join(absoluteDir, entry.name);
		if (entry.isDirectory()) found.push(...walkFiles(full));
		else found.push(full);
	}

	return found;
}

/** Sources a Worker actually ships — tests declare nothing the platform runs. */
function workerSources(absoluteDir: string): { path: string; text: string }[] {
	return walkFiles(absoluteDir)
		.filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
		.map((path) => ({ path: relative(repoRoot, path), text: readFileSync(path, "utf8") }));
}

function readConfig(relativePath: string): WranglerConfig {
	return JSON.parse(stripJsoncComments(readFileSync(resolve(repoRoot, relativePath), "utf8")));
}

/** Bindings are declared per env as often as at the top level; either counts. */
function declaredAnywhere(config: WranglerConfig, has: (block: ConfigBlock) => boolean): boolean {
	return has(config) || Object.values(config.env ?? {}).some(has);
}

function definedIn(sources: { path: string; text: string }[], pattern: RegExp): string[] {
	return sources.filter((source) => pattern.test(source.text)).map((source) => source.path);
}

const WORKERS = [
	{ name: "data-service", dir: "apps/data-service" },
	{ name: "user-application", dir: "apps/user-application" },
];

describe("Worker surface is wired to something that can trigger it", () => {
	for (const worker of WORKERS) {
		const config = readConfig(`${worker.dir}/wrangler.jsonc`);
		const entryPath = join(worker.dir, config.main ?? "src/index.ts");
		const entry = readFileSync(resolve(repoRoot, entryPath), "utf8");
		const sources = workerSources(resolve(repoRoot, worker.dir, "src"));

		it(`${worker.name}: exports a scheduled handler only with a cron trigger declared`, () => {
			const exportsHandler = /^\s*(?:async\s+)?scheduled\s*\(/m.test(entry);
			const triggered = declaredAnywhere(config, (b) => (b.triggers?.crons?.length ?? 0) > 0);

			expect(
				exportsHandler && !triggered,
				`${entryPath} exports scheduled() but no env declares triggers.crons — the handler can never fire`,
			).toBe(false);
		});

		it(`${worker.name}: exports a queue handler only with a queue consumer declared`, () => {
			const exportsHandler = /^\s*(?:async\s+)?queue\s*\(/m.test(entry);
			const consumed = declaredAnywhere(config, (b) => (b.queues?.consumers?.length ?? 0) > 0);

			expect(
				exportsHandler && !consumed,
				`${entryPath} exports queue() but no env declares queues.consumers — the handler can never fire`,
			).toBe(false);
		});

		it(`${worker.name}: defines a Durable Object only with a binding declared`, () => {
			const defining = definedIn(sources, /class\s+\w+\s+extends\s+DurableObject\b/);
			const bound = declaredAnywhere(config, (b) => (b.durable_objects?.bindings?.length ?? 0) > 0);

			expect(
				bound ? [] : defining,
				`${worker.dir}/wrangler.jsonc declares no durable_objects.bindings, so these classes are unreachable`,
			).toEqual([]);
		});

		it(`${worker.name}: defines a Workflow only with a workflow registration declared`, () => {
			const defining = definedIn(sources, /class\s+\w+\s+extends\s+WorkflowEntrypoint\b/);
			const registered = declaredAnywhere(config, (b) => (b.workflows?.length ?? 0) > 0);

			expect(
				registered ? [] : defining,
				`${worker.dir}/wrangler.jsonc declares no workflows, so these classes are unreachable`,
			).toEqual([]);
		});
	}
});

function globToRegExp(glob: string): RegExp {
	const pattern = glob
		.split("/")
		.map((segment) =>
			segment === "**"
				? ".+"
				: segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"),
		)
		.join("/");
	return new RegExp(`^${pattern}$`);
}

interface KnipConfig {
	ignore?: string[];
	workspaces?: Record<string, { ignore?: string[] }>;
}

describe("knip ignore entries name paths that exist", () => {
	const knip = JSON.parse(readFileSync(resolve(repoRoot, "knip.json"), "utf8")) as KnipConfig;
	const workspaces = Object.entries(knip.workspaces ?? {});

	it("declares at least one workspace to check", () => {
		expect(workspaces.length).toBeGreaterThan(0);
	});

	for (const [workspace, settings] of workspaces) {
		const ignores = settings.ignore ?? [];
		if (ignores.length === 0) continue;

		it(`${workspace}: every ignore entry matches a real file`, () => {
			const root = resolve(repoRoot, workspace);
			const files = walkFiles(root).map((path) => relative(root, path));

			const stale = ignores.filter((glob) => {
				const matcher = globToRegExp(glob);
				return !files.some((file) => matcher.test(file));
			});

			expect(
				stale,
				`knip.json workspaces["${workspace}"].ignore exempts paths that no longer exist — a stale exemption widens what knip stops looking at`,
			).toEqual([]);
		});
	}
});
