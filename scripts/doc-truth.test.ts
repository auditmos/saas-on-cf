/**
 * Guardrail: agent-facing documentation may only point at files that exist.
 *
 * Coding agents read these files as instructions, not as prose. A rule
 * describing a system nobody built does not read as out of date — it reads as a
 * specification, and the next agent extends it. Every path these documents name
 * is therefore a claim, and this is what makes the claim checkable.
 *
 * A reference resolves if any real path in the repository ends with it, so a
 * document is free to name `routes/index.tsx` without also spelling out which
 * app it lives in. What the check catches is the reference that matches nothing
 * anywhere — the file that was never written. An empty directory counts as
 * nothing: pointing at one is the same claim, made about a hole.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

const SKIP_DIRS = new Set([
	".cache",
	".git",
	".turbo",
	".wrangler",
	"coverage",
	"dist",
	"node_modules",
	"plugins",
	"skills",
]);

/** Documents an agent is expected to follow. CLAUDE.md is a symlink to AGENTS.md. */
function isAgentFacing(relative: string): boolean {
	if (relative === "AGENTS.md" || relative === "llms.txt") return true;
	if (relative.endsWith("/AGENTS.md")) return true;
	return relative.startsWith(".claude/rules/") && relative.endsWith(".md");
}

interface RepoIndex {
	files: string[];
	/** Directories holding at least one file, at any depth. */
	populatedDirs: string[];
	docs: string[];
}

function indexRepo(): RepoIndex {
	const files: string[] = [];
	const populatedDirs: string[] = [];

	// Returns whether this directory holds a file at any depth: an empty one is
	// not somewhere a document can point.
	const walk = (absolute: string): boolean => {
		let holdsFiles = false;

		for (const entry of readdirSync(absolute, { withFileTypes: true })) {
			if (SKIP_DIRS.has(entry.name)) continue;

			const full = join(absolute, entry.name);
			const relative = full.slice(repoRoot.length + 1);

			if (!entry.isDirectory()) {
				files.push(relative);
				holdsFiles = true;
			} else if (walk(full)) {
				populatedDirs.push(relative);
				holdsFiles = true;
			}
		}

		return holdsFiles;
	};

	walk(repoRoot);
	return { files, populatedDirs, docs: files.filter(isAgentFacing).sort() };
}

const repo = indexRepo();

const PATH_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|mts|cjs|json|jsonc|md|txt|sh|sql|css|toml|ya?ml)$/;

const REPO_PREFIXES = ["apps/", "packages/", "scripts/", "docs/", ".claude/", ".github/", "src/"];

/**
 * Package specifiers, URLs, protocol imports, property access and placeholder
 * templates are not filesystem claims. A reference has to name a directory to
 * count: a bare `schema.ts` in prose nods at a convention, while
 * `i18n/messages/en.json` asserts that a particular file is there.
 */
/** Drops `./`, `../` and leading slashes without eating a dotfile's own dot. */
function normalise(raw: string): string {
	return raw
		.trim()
		.replace(/^(\.{1,2}\/)+/, "")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

function looksLikeRepoPath(raw: string): boolean {
	const token = raw.trim();
	if (!token || /\s/.test(token)) return false;
	if (/^(https?:|mailto:|#)/.test(token)) return false;
	if (/[:{}*<>()[\]|'"`,]/.test(token)) return false;
	if (token.startsWith("@")) return false;

	const bare = normalise(token);
	if (!bare.includes("/")) return false;
	if (bare.split("/").some((segment) => segment === "" || segment === "..")) return false;

	if (REPO_PREFIXES.some((prefix) => `${bare}/`.startsWith(prefix))) return true;
	return PATH_EXTENSIONS.test(bare) || raw.trim().endsWith("/");
}

/** Strips tree-diagram art so `├── routes/index.tsx` reads as a path. */
function stripTreeArt(line: string): string {
	return line.replace(/[│├└─┃┣┗|`+\\]/g, " ");
}

function extractReferences(source: string): string[] {
	const found = new Set<string>();

	const consider = (token: string | undefined) => {
		if (token && looksLikeRepoPath(token)) found.add(token.trim().replace(/\/+$/, ""));
	};

	for (const [, token] of source.matchAll(/`([^`\n]+)`/g)) consider(token);
	for (const [, token] of source.matchAll(/\]\(([^)\s]+)\)/g)) consider(token);

	// Structure diagrams live in fenced blocks and are the densest source of
	// claims about what this repository contains.
	for (const line of source.split("\n")) {
		for (const token of stripTreeArt(line).split(/\s+/)) consider(token);
	}

	return [...found].sort();
}

function resolves(reference: string): boolean {
	const target = normalise(reference);
	if (!target) return false;
	const suffix = `/${target}`;
	const matches = (path: string) => path === target || path.endsWith(suffix);
	return repo.files.some(matches) || repo.populatedDirs.some(matches);
}

describe("agent-facing documentation only points at files that exist", () => {
	it("finds the documents to check", () => {
		expect(repo.docs.length).toBeGreaterThan(0);
	});

	for (const doc of repo.docs) {
		it(`${doc}: every path it names resolves`, () => {
			const dangling = extractReferences(readFileSync(resolve(repoRoot, doc), "utf8")).filter(
				(reference) => !resolves(reference),
			);

			expect(
				dangling,
				`${doc} names ${dangling.length} path(s) that exist nowhere in the repo: ${dangling.join(", ")}`,
			).toEqual([]);
		});
	}
});
