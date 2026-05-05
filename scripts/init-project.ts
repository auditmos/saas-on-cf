#!/usr/bin/env tsx
/**
 * One-shot project bootstrap. Idempotent — safe to re-run.
 *
 * 1. Prompt once for kebab-case project name.
 * 2. Rename root package.json + every Worker wrangler.jsonc (skip if already renamed).
 * 3. Warn if wrangler.jsonc lacks env.staging / env.production blocks.
 * 4. Fan out *.example templates into per-environment files (skip if exists).
 * 5. Print a next-steps checklist.
 *
 * Sub-package names (`@repo/data-ops`, etc.) are intentionally NOT renamed —
 * pnpm filter scripts depend on them.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
	console.log("[1/4] Rename project references");
	for (const target of RENAME_TARGETS) {
		const result = applyRename(target, name);
		console.log(`      ${symbolFor(result)} ${target.file} (${result})`);
	}
}

function stepVerifyWrangler(): void {
	console.log("\n[2/4] Verify wrangler env blocks");
	const warnings = WRANGLER_FILES.flatMap((w) => checkWranglerEnvs(abs(w), REQUIRED_WRANGLER_ENVS));
	if (warnings.length === 0) {
		console.log(`      ✓ all wrangler.jsonc declare ${REQUIRED_WRANGLER_ENVS.join(", ")}`);
		return;
	}
	for (const w of warnings) console.log(`      ⚠ ${w}`);
	console.log("      (warn-only — script does not modify wrangler structure)");
}

function stepFanoutEnv(): void {
	console.log("\n[3/4] Create per-environment env files");
	for (const { template, targets } of ENV_TEMPLATES) {
		for (const target of targets) {
			const result = fanoutEnv(template, target);
			const detail = result === "copied" ? `from ${template}` : result;
			console.log(`      ${symbolFor(result)} ${target} (${detail})`);
		}
	}
}

function stepNextSteps(name: string): void {
	console.log("\n[4/4] Next steps:\n");
	for (const step of NEXT_STEPS) console.log(`  ${step}`);
	console.log(
		`\n✓ Project "${name}" initialized. Re-run anytime — already-applied steps are skipped.`,
	);
}

// ── main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const name = await prompt("Project name (kebab-case): ");
	if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
		console.error("✗ Invalid name. Must be kebab-case (e.g. my-app).");
		process.exit(1);
	}

	console.log(`\n→ Initializing project: ${name}\n`);
	stepRename(name);
	stepVerifyWrangler();
	stepFanoutEnv();
	stepNextSteps(name);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
