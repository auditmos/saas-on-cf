#!/usr/bin/env tsx
/**
 * One-shot project bootstrap. Idempotent — safe to re-run.
 *
 * 1. Prompt for kebab-case project name, production domain, staging subdomain prefix.
 * 2. Rename root package.json + every Worker wrangler.jsonc (skip if already renamed).
 * 3. Warn if wrangler.jsonc lacks env.staging / env.production blocks.
 * 4. Fan out *.example templates into per-environment files (skip if exists).
 * 5. Wire wrangler routes for staging + production from the supplied domain.
 * 6. Print a next-steps checklist.
 *
 * Non-interactive flags: --name, --domain, --staging-prefix, --non-interactive.
 * Override target root via INIT_PROJECT_ROOT env var (used by tests).
 *
 * Sub-package names (`@repo/data-ops`, etc.) are intentionally NOT renamed —
 * pnpm filter scripts depend on them.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = process.env.INIT_PROJECT_ROOT
	? path.resolve(process.env.INIT_PROJECT_ROOT)
	: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGINAL_PKG_NAME = "saas-on-cf";

type RenameTarget =
	| { file: string; mode: "package-name" }
	| { file: string; mode: "all-occurrences"; needle: string };
type EnvTemplate = { template: string; targets: string[] };
type RenameResult = "renamed" | "skipped" | "missing";
type FanoutResult = "copied" | "skipped" | "no-template";

const RENAME_TARGETS: RenameTarget[] = [
	{ file: "package.json", mode: "package-name" },
	{ file: "apps/data-service/wrangler.jsonc", mode: "all-occurrences", needle: ORIGINAL_PKG_NAME },
	{
		file: "apps/user-application/wrangler.jsonc",
		mode: "all-occurrences",
		needle: ORIGINAL_PKG_NAME,
	},
];

const ENV_TEMPLATES: EnvTemplate[] = [
	{
		template: "apps/user-application/.env.example",
		targets: [
			"apps/user-application/.env",
			"apps/user-application/.env.staging",
			"apps/user-application/.env.production",
		],
	},
	{
		template: "apps/data-service/.dev.vars.example",
		targets: [
			"apps/data-service/.dev.vars",
			"apps/data-service/.staging.vars",
			"apps/data-service/.production.vars",
		],
	},
	{
		template: "packages/data-ops/.env.example",
		targets: [
			"packages/data-ops/.env.dev",
			"packages/data-ops/.env.staging",
			"packages/data-ops/.env.production",
		],
	},
];

const WRANGLER_FILES = ["apps/data-service/wrangler.jsonc", "apps/user-application/wrangler.jsonc"];
const REQUIRED_WRANGLER_ENVS = ["staging", "production"];

type WranglerKind = "data-service" | "user-application";

export interface RouteConfig {
	domain: string;
	stagingPrefix: string;
}

const ROUTE_WRANGLERS: { file: string; kind: WranglerKind }[] = [
	{ file: "apps/data-service/wrangler.jsonc", kind: "data-service" },
	{ file: "apps/user-application/wrangler.jsonc", kind: "user-application" },
];

function canonicalRoutePattern(
	env: "staging" | "production",
	config: RouteConfig,
	kind: WranglerKind,
): string {
	const { domain, stagingPrefix } = config;
	if (kind === "data-service") {
		return env === "staging" ? `api-${stagingPrefix}.${domain}` : `api.${domain}`;
	}
	return env === "staging" ? `${stagingPrefix}.${domain}` : domain;
}

function renderRoutesBlock(indent: string, pattern: string): string {
	return (
		`${indent}"routes": [\n` +
		`${indent}\t{\n` +
		`${indent}\t\t"pattern": "${pattern}",\n` +
		`${indent}\t\t"custom_domain": true\n` +
		`${indent}\t}\n` +
		`${indent}],\n`
	);
}

interface ScanState {
	inString: boolean;
	inLineComment: boolean;
}

function stepScanner(
	content: string,
	i: number,
	state: ScanState,
): { i: number; braceDelta: number } {
	const ch = content[i];
	if (state.inLineComment) {
		if (ch === "\n") state.inLineComment = false;
		return { i: i + 1, braceDelta: 0 };
	}
	if (state.inString) {
		if (ch === '"' && content[i - 1] !== "\\") state.inString = false;
		return { i: i + 1, braceDelta: 0 };
	}
	if (ch === "/" && content[i + 1] === "/") {
		state.inLineComment = true;
		return { i: i + 2, braceDelta: 0 };
	}
	if (ch === '"') state.inString = true;
	const braceDelta = ch === "{" ? 1 : ch === "}" ? -1 : 0;
	return { i: i + 1, braceDelta };
}

// Scan forward from an opening `{` and return the index AFTER its matching `}`.
// Honors JSON strings and `// ...` line comments so that braces inside them don't disturb depth.
function findMatchingBraceEnd(content: string, openBraceIdx: number): number {
	let depth = 1;
	let i = openBraceIdx + 1;
	const state: ScanState = { inString: false, inLineComment: false };
	while (i < content.length && depth > 0) {
		const step = stepScanner(content, i, state);
		i = step.i;
		depth += step.braceDelta;
	}
	return i;
}

// Locate the end of an existing routes block (commented or uncommented) by tracking [/] depth.
// Returns the index AFTER the closing `],` (and trailing newline), so a slice up to here removes
// the whole routes block including its terminator.
function findRoutesBlockEnd(content: string, startIdx: number, limit: number): number {
	let depth = 0;
	let foundOpener = false;
	for (let i = startIdx; i < limit; i++) {
		const ch = content[i];
		if (ch === "[") {
			depth++;
			foundOpener = true;
			continue;
		}
		if (ch !== "]") continue;
		depth--;
		if (!foundOpener || depth !== 0) continue;
		let cursor = i + 1;
		if (content[cursor] === ",") cursor++;
		if (content[cursor] === "\n") cursor++;
		return cursor;
	}
	return limit;
}

function rewriteEnvRoutes(content: string, env: "staging" | "production", pattern: string): string {
	const openRe = new RegExp(`"${env}":\\s*\\{`);
	const openMatch = openRe.exec(content);
	if (!openMatch) return content;
	const openBraceIdx = openMatch.index + openMatch[0].length - 1;
	const blockEnd = findMatchingBraceEnd(content, openBraceIdx);
	const afterOpen = openBraceIdx + 1;

	const blockBody = content.slice(afterOpen, blockEnd - 1);
	const routesRe = /([ \t]+)(?:\/\/ )?"routes":\s*\[/;
	const routesMatch = routesRe.exec(blockBody);

	if (!routesMatch) {
		const indentForInsert =
			blockBody.match(/\n([ \t]+)\S/)?.[1] ?? openMatch[0].match(/^([ \t]*)/)?.[1] ?? "\t\t\t";
		const newBlock = `\n${renderRoutesBlock(indentForInsert, pattern)}`;
		return content.slice(0, afterOpen) + newBlock + content.slice(afterOpen).replace(/^\n?/, "");
	}

	const routesStart = afterOpen + routesMatch.index;
	const indent = routesMatch[1];
	const cursor = findRoutesBlockEnd(content, routesStart, blockEnd);

	return content.slice(0, routesStart) + renderRoutesBlock(indent, pattern) + content.slice(cursor);
}

export function applyRouteConfig(content: string, config: RouteConfig, kind: WranglerKind): string {
	let result = content;
	for (const env of ["staging", "production"] as const) {
		result = rewriteEnvRoutes(result, env, canonicalRoutePattern(env, config, kind));
	}
	return result;
}

const NEXT_STEPS = [
	"Fill DB credentials (DATABASE_HOST/USERNAME/PASSWORD) in:",
	"  - apps/data-service/.{dev,staging,production}.vars",
	"  - packages/data-ops/.env.{dev,staging,production}",
	"  Get from https://console.neon.tech",
	"Set BETTER_AUTH_SECRET in apps/user-application/.env*",
	"  Generate with: openssl rand -base64 32",
	"Set VITE_API_TOKEN + DATA_SERVICE_API_TOKEN + API_TOKEN to the same value",
	"  per env (frontend/binding/data-service must agree).",
	"(optional) Delete the example `client` domain when ready — see README Step 6.",
	"Run setup + migrations: pnpm run setup && pnpm run db:generate:dev && pnpm run db:migrate:dev",
	"Start dev (two terminals):",
	"  pnpm run dev:data-service       # API on :8788",
	"  pnpm run dev:user-application   # frontend on :3000",
];

// ── helpers ──────────────────────────────────────────────────────────

function abs(...segments: string[]): string {
	return path.join(ROOT, ...segments);
}

async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

function readJson<T = unknown>(file: string): T {
	return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function writeJson(file: string, value: unknown): void {
	fs.writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`, "utf-8");
}

function renamePackageJson(file: string, name: string): "renamed" | "skipped" {
	const pkg = readJson<{ name?: string }>(file);
	if (pkg.name === name) return "skipped";
	pkg.name = name;
	writeJson(file, pkg);
	return "renamed";
}

function renameAllOccurrences(file: string, name: string, needle: string): "renamed" | "skipped" {
	const content = fs.readFileSync(file, "utf-8");
	const replaced = content.replaceAll(needle, name);
	if (replaced === content) return "skipped";
	fs.writeFileSync(file, replaced, "utf-8");
	return "renamed";
}

function applyRename(target: RenameTarget, name: string): RenameResult {
	const file = abs(target.file);
	if (!fs.existsSync(file)) return "missing";
	if (target.mode === "package-name") return renamePackageJson(file, name);
	return renameAllOccurrences(file, name, target.needle);
}

function stripJsonc(content: string): string {
	return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function checkWranglerEnvs(file: string, required: string[]): string[] {
	if (!fs.existsSync(file)) return [`${file}: file not found`];
	let parsed: { env?: Record<string, unknown> };
	try {
		parsed = JSON.parse(stripJsonc(fs.readFileSync(file, "utf-8"))) as {
			env?: Record<string, unknown>;
		};
	} catch (e) {
		return [`${file}: parse failed (${(e as Error).message.split("\n")[0]})`];
	}
	const envs = parsed.env ?? {};
	return required.filter((e) => !envs[e]).map((e) => `${file}: missing env.${e}`);
}

function fanoutEnv(template: string, target: string): FanoutResult {
	const templatePath = abs(template);
	const targetPath = abs(target);
	if (!fs.existsSync(templatePath)) return "no-template";
	if (fs.existsSync(targetPath)) return "skipped";
	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.copyFileSync(templatePath, targetPath);
	return "copied";
}

function symbolFor(result: RenameResult | FanoutResult): string {
	if (result === "renamed" || result === "copied") return "✓";
	if (result === "skipped") return "·";
	return "✗";
}

// ── steps ────────────────────────────────────────────────────────────

function stepRename(name: string): void {
	console.log("[1/5] Rename project references");
	for (const target of RENAME_TARGETS) {
		const result = applyRename(target, name);
		console.log(`      ${symbolFor(result)} ${target.file} (${result})`);
	}
}

function stepVerifyWrangler(): void {
	console.log("\n[2/5] Verify wrangler env blocks");
	const warnings = WRANGLER_FILES.flatMap((w) => checkWranglerEnvs(abs(w), REQUIRED_WRANGLER_ENVS));
	if (warnings.length === 0) {
		console.log(`      ✓ all wrangler.jsonc declare ${REQUIRED_WRANGLER_ENVS.join(", ")}`);
		return;
	}
	for (const w of warnings) console.log(`      ⚠ ${w}`);
	console.log("      (warn-only — script does not modify wrangler structure)");
}

function stepFanoutEnv(): void {
	console.log("\n[3/5] Create per-environment env files");
	for (const { template, targets } of ENV_TEMPLATES) {
		for (const target of targets) {
			const result = fanoutEnv(template, target);
			const detail = result === "copied" ? `from ${template}` : result;
			console.log(`      ${symbolFor(result)} ${target} (${detail})`);
		}
	}
}

function stepWireRoutes(config: RouteConfig): void {
	console.log("\n[4/5] Wire wrangler routes");
	for (const { file, kind } of ROUTE_WRANGLERS) {
		const targetPath = abs(file);
		if (!fs.existsSync(targetPath)) {
			console.log(`      ✗ ${file} (missing)`);
			continue;
		}
		const content = fs.readFileSync(targetPath, "utf-8");
		const updated = applyRouteConfig(content, config, kind);
		if (updated === content) {
			console.log(`      · ${file} (skipped)`);
			continue;
		}
		fs.writeFileSync(targetPath, updated, "utf-8");
		console.log(`      ✓ ${file} (wired ${kind} routes)`);
	}
}

function stepNextSteps(name: string): void {
	console.log("\n[5/5] Next steps:\n");
	for (const step of NEXT_STEPS) console.log(`  ${step}`);
	console.log(
		`\n✓ Project "${name}" initialized. Re-run anytime — already-applied steps are skipped.`,
	);
}

// ── CLI args ─────────────────────────────────────────────────────────

interface CliArgs {
	name?: string;
	domain?: string;
	stagingPrefix?: string;
	nonInteractive: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
	const out: CliArgs = { nonInteractive: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--non-interactive":
				out.nonInteractive = true;
				break;
			case "--name":
				out.name = argv[++i];
				break;
			case "--domain":
				out.domain = argv[++i];
				break;
			case "--staging-prefix":
				out.stagingPrefix = argv[++i];
				break;
		}
	}
	return out;
}

// ── main ─────────────────────────────────────────────────────────────

const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

async function main(): Promise<void> {
	const args = parseCliArgs(process.argv.slice(2));

	const name = args.name ?? (await prompt("Project name (kebab-case): "));
	if (!KEBAB_RE.test(name)) {
		console.error("✗ Invalid name. Must be kebab-case (e.g. my-app).");
		process.exit(1);
	}

	const domainAnswer =
		args.domain ??
		(args.nonInteractive
			? ""
			: await prompt("Production domain (e.g. example.com, blank to skip): "));
	const domain = domainAnswer.trim();

	const stagingPrefixAnswer =
		args.stagingPrefix ??
		(args.nonInteractive ? "staging" : await prompt("Staging subdomain prefix [staging]: "));
	const stagingPrefix = stagingPrefixAnswer.trim() || "staging";

	console.log(`\n→ Initializing project: ${name}\n`);
	stepRename(name);
	stepVerifyWrangler();
	stepFanoutEnv();
	if (domain) {
		stepWireRoutes({ domain, stagingPrefix });
	} else {
		console.log("\n[4/5] Wire wrangler routes — skipped (no domain provided)");
	}
	stepNextSteps(name);
}

const isCliEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isCliEntry) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
