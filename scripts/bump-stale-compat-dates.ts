#!/usr/bin/env tsx
/**
 * Bumps each Worker's compatibility_date once it is more than 90 days old.
 *
 * The new date is today, capped at the newest date the Worker's local runtimes
 * support. Each tool that runs a Worker locally — wrangler, the Vite plugin,
 * the Vitest plugin — ships its own workerd, and workerd refuses to start a
 * Worker dated later than it knows. A date past the oldest of them stops
 * `wrangler dev`, `vite dev` or the Workers test pool, and the runtime
 * behaviour it turns on reaches production without ever running locally.
 * When the cap holds a Worker back, upgrading those tools is what moves it.
 */
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const THRESHOLD_DAYS = 90;
const MS_PER_DAY = 86_400_000;
const DATE_FIELD_RE = /("compatibility_date"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/;

/** Tools that load a Worker into a local workerd. */
const RUNTIME_TOOLS = ["wrangler", "@cloudflare/vite-plugin", "@cloudflare/vitest-plugin"];

export class RuntimeLookupError extends Error {
	constructor(
		public workerDir: string,
		message: string,
	) {
		super(message);
		this.name = "RuntimeLookupError";
	}
}

export interface Runtime {
	tool: string;
	workerd: string;
	/** The newest compatibility date this workerd supports. */
	compatibilityDate: string;
}

export type BumpPlan =
	| { kind: "fresh" }
	| { kind: "bump"; to: string; capped: boolean; stillStale: boolean }
	| { kind: "blocked" };

interface Manifest {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

const loadModule = createRequire(import.meta.url);

/** Node's lookup for a bare specifier, minus `exports`, which hides package.json in some packages. */
function packageDir(name: string, fromDir: string): string | undefined {
	for (let dir = fromDir; ; dir = dirname(dir)) {
		const manifest = join(dir, "node_modules", name, "package.json");
		if (existsSync(manifest)) return dirname(realpathSync(manifest));
		if (dirname(dir) === dir) return undefined;
	}
}

function readManifest(dir: string): Manifest {
	return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
}

/**
 * Where `name` resolves from the package in `fromDir`, if that package declares it.
 * Walking up alone is not enough: pnpm hoists one copy of every package into
 * node_modules/.pnpm/node_modules, so any walk eventually finds *a* workerd.
 */
function dependencyDir(name: string, fromDir: string): string | undefined {
	const { dependencies, optionalDependencies, peerDependencies } = readManifest(fromDir);
	if (!(name in { ...dependencies, ...optionalDependencies, ...peerDependencies }))
		return undefined;
	return packageDir(name, fromDir);
}

/** The workerd each runtime tool declared by the Worker in `workerDir` would start. */
export function installedRuntimes(workerDir: string): Runtime[] {
	const manifest = readManifest(workerDir);
	const declared = { ...manifest.dependencies, ...manifest.devDependencies };
	const runtimes: Runtime[] = [];

	for (const tool of RUNTIME_TOOLS.filter((name) => name in declared)) {
		const toolDir = packageDir(tool, workerDir);
		if (!toolDir) {
			throw new RuntimeLookupError(
				workerDir,
				`${tool} is declared but not installed — run \`pnpm install\``,
			);
		}
		// wrangler depends on workerd directly; the plugins reach it through miniflare.
		const miniflareDir = dependencyDir("miniflare", toolDir);
		const workerdDirs = new Set(
			[
				dependencyDir("workerd", toolDir),
				miniflareDir && dependencyDir("workerd", miniflareDir),
			].filter((dir): dir is string => Boolean(dir)),
		);
		if (workerdDirs.size === 0) {
			throw new RuntimeLookupError(workerDir, `no workerd found behind ${tool}`);
		}
		for (const dir of workerdDirs) {
			const { compatibilityDate, version } = loadModule(dir) as {
				compatibilityDate: string;
				version: string;
			};
			runtimes.push({ tool, workerd: version, compatibilityDate });
		}
	}
	return runtimes;
}

/** The newest date every runtime supports: the oldest runtime's limit. */
export function newestSupportedDate(runtimes: Runtime[]): string | undefined {
	return runtimes.map((runtime) => runtime.compatibilityDate).sort()[0];
}

function ageInDays(date: string, today: string): number {
	return Math.floor((Date.parse(today) - Date.parse(date)) / MS_PER_DAY);
}

/** What to do with a Worker dated `current`, given today and the newest date its runtimes support. */
export function planBump(current: string, today: string, supported: string): BumpPlan {
	if (ageInDays(current, today) <= THRESHOLD_DAYS) return { kind: "fresh" };

	const to = supported < today ? supported : today;
	if (to <= current) return { kind: "blocked" };

	return {
		kind: "bump",
		to,
		capped: to !== today,
		stillStale: ageInDays(to, today) > THRESHOLD_DAYS,
	};
}

function describeRuntimes(runtimes: Runtime[]): string {
	return runtimes.map((runtime) => `${runtime.tool} → workerd ${runtime.workerd}`).join(", ");
}

interface FileOutcome {
	stale: boolean;
	/** The pull request's line for this file, when it was bumped. */
	summary?: string;
}

/** Checks one wrangler.jsonc and, unless `checkOnly`, bumps it. */
function bumpFile(file: string, today: string, checkOnly: boolean): FileOutcome {
	const content = readFileSync(file, "utf8");
	const current = content.match(DATE_FIELD_RE)?.[2];
	if (!current) {
		console.warn(`::warning file=${file}::no compatibility_date found`);
		return { stale: false };
	}

	const runtimes = installedRuntimes(dirname(file));
	const supported = newestSupportedDate(runtimes);
	if (!supported) {
		throw new RuntimeLookupError(
			dirname(file),
			`declares none of ${RUNTIME_TOOLS.join(", ")}, so the newest date its runtime supports is unknown`,
		);
	}

	const age = ageInDays(current, today);
	const plan = planBump(current, today, supported);
	const runtimeList = describeRuntimes(runtimes);

	if (plan.kind === "fresh") {
		console.log(`OK      ${file}: ${current} (${age}d old)`);
		return { stale: false };
	}

	if (plan.kind === "blocked") {
		console.warn(
			`::warning file=${file}::compatibility_date ${current} is ${age}d old, and the local runtimes support nothing newer than ${supported} (${runtimeList}). Upgrade them to move it.`,
		);
		return { stale: true };
	}

	const cap = plan.capped ? `, capped by ${runtimeList}` : "";
	if (checkOnly) {
		console.log(`STALE   ${file}: ${current} (${age}d old), would bump to ${plan.to}${cap}`);
		return { stale: true };
	}

	writeFileSync(file, content.replace(DATE_FIELD_RE, `$1${plan.to}$3`));
	console.log(`BUMPED  ${file}: ${current} → ${plan.to} (${age}d old${cap})`);
	if (plan.stillStale) {
		console.warn(
			`::warning file=${file}::${plan.to} is still more than ${THRESHOLD_DAYS} days old. Upgrade ${runtimeList} to move it further.`,
		);
	}
	return {
		stale: true,
		summary: `- \`${file}\`: \`${current}\` → \`${plan.to}\` (${age}d old${cap})`,
	};
}

function main(): void {
	const checkOnly = process.argv.includes("--check");
	const today = new Date().toISOString().slice(0, 10);

	const files = execSync('find apps packages -name wrangler.jsonc -not -path "*/node_modules/*"', {
		encoding: "utf8",
	})
		.trim()
		.split("\n")
		.filter(Boolean);

	if (files.length === 0) {
		console.error("No wrangler.jsonc files found under apps/ or packages/");
		process.exit(1);
	}

	const summary: string[] = [];
	let stale = 0;

	for (const file of files) {
		const outcome = bumpFile(file, today, checkOnly);
		if (outcome.stale) stale++;
		if (outcome.summary) summary.push(outcome.summary);
	}

	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `changed=${summary.length > 0}\n`);
		appendFileSync(process.env.GITHUB_OUTPUT, `summary<<__EOF__\n${summary.join("\n")}\n__EOF__\n`);
	}

	if (checkOnly && stale > 0) {
		console.error(`\n${stale} file(s) have compatibility_date older than ${THRESHOLD_DAYS} days`);
		process.exit(1);
	}

	console.log(`\n${files.length} file(s) checked, ${stale} stale, ${summary.length} bumped`);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	try {
		main();
	} catch (error) {
		if (error instanceof RuntimeLookupError) {
			console.error(`${error.workerDir}: ${error.message}`);
			process.exit(1);
		}
		throw error;
	}
}
