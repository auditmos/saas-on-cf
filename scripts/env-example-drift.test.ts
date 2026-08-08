import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

// Wrangler-generated worker-configuration.d.ts contains a NodeJS.ProcessEnv
// declaration that Picks only the env-var (string-typed) members of Cloudflare.Env,
// excluding bindings like RateLimit, Fetcher, etc. That Pick<> is the canonical
// list of placeholders an example env file must mirror.
const PROCESS_ENV_PICK_RE =
	/interface\s+ProcessEnv\s+extends\s+StringifyValues<Pick<Cloudflare\.Env,\s*([^>]+)>>/;

function stripJsoncComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface WranglerConfig {
	vars?: Record<string, string>;
	env?: Record<string, { vars?: Record<string, string> }>;
}

// Vars declared in wrangler.jsonc (top-level or per env block) are baked into
// deploys and don't need example placeholders. Subtract them from the required set.
function extractWranglerVars(wranglerFile: string): Set<string> {
	const raw = readFileSync(wranglerFile, "utf8");
	const parsed = JSON.parse(stripJsoncComments(raw)) as WranglerConfig;
	const keys = new Set<string>();
	for (const k of Object.keys(parsed.vars ?? {})) keys.add(k);
	for (const block of Object.values(parsed.env ?? {})) {
		for (const k of Object.keys(block?.vars ?? {})) keys.add(k);
	}
	return keys;
}

function extractRequiredEnvVars(typesFile: string): Set<string> {
	const content = readFileSync(typesFile, "utf8");
	const match = content.match(PROCESS_ENV_PICK_RE);
	if (!match?.[1]) {
		throw new Error(`No NodeJS.ProcessEnv Pick<Cloudflare.Env, ...> in ${typesFile}`);
	}
	const keys = match[1]
		.split("|")
		.map((raw) => raw.trim().replace(/^"|"$/g, ""))
		.filter((k) => k.length > 0);
	return new Set(keys);
}

function extractExampleKeys(exampleFile: string): Set<string> {
	const content = readFileSync(exampleFile, "utf8");
	const keys = new Set<string>();
	for (const rawLine of content.split("\n")) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
		if (match?.[1]) keys.add(match[1]);
	}
	return keys;
}

interface DriftTarget {
	name: string;
	typesFile: string;
	exampleFile: string;
	wranglerFile: string;
}

const targets: DriftTarget[] = [
	{
		name: "data-service",
		typesFile: resolve(repoRoot, "apps/data-service/worker-configuration.d.ts"),
		exampleFile: resolve(repoRoot, "apps/data-service/.dev.vars.example"),
		wranglerFile: resolve(repoRoot, "apps/data-service/wrangler.jsonc"),
	},
	{
		name: "user-application",
		typesFile: resolve(repoRoot, "apps/user-application/worker-configuration.d.ts"),
		exampleFile: resolve(repoRoot, "apps/user-application/.env.example"),
		wranglerFile: resolve(repoRoot, "apps/user-application/wrangler.jsonc"),
	},
];

describe("env example file drift", () => {
	for (const target of targets) {
		describe(target.name, () => {
			it("declares a placeholder for every env var in worker-configuration.d.ts", () => {
				const required = extractRequiredEnvVars(target.typesFile);
				const wranglerVars = extractWranglerVars(target.wranglerFile);
				const present = extractExampleKeys(target.exampleFile);
				const missing = [...required].filter((key) => !present.has(key) && !wranglerVars.has(key));
				expect(
					missing,
					`${target.exampleFile} is missing placeholders for: ${missing.join(", ")}`,
				).toEqual([]);
			});

			// The mirror image, and the one a fork author feels: a placeholder for
			// something nothing reads asks them to go find a value that will never
			// be used. A key wrangler.jsonc already declares is the same trap — the
			// deploy takes its value from there, so whatever they type is ignored.
			it("declares no placeholder that nothing reads", () => {
				const required = extractRequiredEnvVars(target.typesFile);
				const wranglerVars = extractWranglerVars(target.wranglerFile);
				const present = extractExampleKeys(target.exampleFile);
				const unreferenced = [...present].filter((key) => !required.has(key));
				const alreadyInWrangler = [...present].filter((key) => wranglerVars.has(key));

				expect(
					unreferenced,
					`${target.exampleFile} declares keys absent from worker-configuration.d.ts, so nothing reads them: ${unreferenced.join(", ")}`,
				).toEqual([]);
				expect(
					alreadyInWrangler,
					`${target.exampleFile} declares keys wrangler.jsonc already sets, so a value typed here has no effect: ${alreadyInWrangler.join(", ")}`,
				).toEqual([]);
			});
		});
	}
});

/**
 * One example format per app. Two teaches a fork author to fill in whichever
 * they find first, and only one of them is the file the tooling reads.
 */
describe("one env example format per app", () => {
	for (const target of targets) {
		it(`${target.name}: has no competing example file beside ${basename(target.exampleFile)}`, () => {
			const appDir = dirname(target.exampleFile);
			const kept = basename(target.exampleFile);
			const competing = readdirSync(appDir).filter(
				(name) =>
					name !== kept && /(^\.example\.|\.example$|example\.vars$|\.example\.)/.test(name),
			);

			expect(
				competing,
				`${appDir} carries more than one env example format: ${competing.join(", ")}`,
			).toEqual([]);
		});
	}
});
