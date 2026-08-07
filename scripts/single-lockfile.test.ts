import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SKIP_DIRS = new Set([
	"node_modules",
	".wrangler",
	".git",
	"dist",
	".turbo",
	"coverage",
	".tanstack",
	".output",
	".vinxi",
	".nitro",
]);

// Any of these committed at once means more than one dependency graph.
const LOCKFILE_NAMES = new Set([
	"pnpm-lock.yaml",
	"package-lock.json",
	"yarn.lock",
	"bun.lock",
	"bun.lockb",
]);

const REFERENCE_SCAN_EXTS = new Set([
	".json",
	".jsonc",
	".yaml",
	".yml",
	".md",
	".ts",
	".tsx",
	".mts",
	".toml",
	".sh",
]);

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function walk(dir: string, onFile: (fullPath: string, name: string) => void): void {
	let entries: ReturnType<typeof readdirSync>;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, onFile);
		} else if (entry.isFile()) {
			onFile(full, entry.name);
		}
	}
}

function findLockfiles(): string[] {
	const found: string[] = [];
	walk(repoRoot, (full, name) => {
		if (LOCKFILE_NAMES.has(name)) found.push(relative(repoRoot, full));
	});
	return found.sort();
}

function findReferencesToNestedLockfiles(): string[] {
	const offenders: string[] = [];
	walk(repoRoot, (full, name) => {
		const dot = name.lastIndexOf(".");
		const ext = dot === -1 ? "" : name.slice(dot);
		if (!REFERENCE_SCAN_EXTS.has(ext)) return;
		const rel = relative(repoRoot, full);
		// The guardrail itself names the paths it forbids.
		if (rel === "scripts/single-lockfile.test.ts") return;

		const lines = readFileSync(full, "utf8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) continue;
			// A lockfile reference that is prefixed by a path segment points somewhere
			// other than the workspace root.
			if (/[\w./-]+\/(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)/.test(line)) {
				offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
			}
		}
	});
	return offenders.sort();
}

describe("single lockfile at the workspace root", () => {
	it("commits exactly one lockfile, and it lives at the workspace root", () => {
		const lockfiles = findLockfiles();
		expect(
			lockfiles,
			`Expected exactly one lockfile at the workspace root. Found:\n${lockfiles.join("\n")}`,
		).toEqual(["pnpm-lock.yaml"]);
	});

	it("has no tooling, CI, or documentation reference to a nested lockfile", () => {
		const offenders = findReferencesToNestedLockfiles();
		expect(
			offenders,
			`Reference to a non-root lockfile found — the workspace has a single dependency graph:\n${offenders.join("\n")}`,
		).toEqual([]);
	});
});
