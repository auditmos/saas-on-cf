import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const SCAN_ROOTS = ["apps/data-service/src", "apps/user-application/src", "packages/data-ops/src"];

const SOURCE_EXTS = new Set([".ts", ".tsx"]);

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function isProductionSourceFile(name: string): boolean {
	if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) return false;
	if (name.endsWith(".spec.ts") || name.endsWith(".spec.tsx")) return false;
	const dot = name.lastIndexOf(".");
	if (dot === -1) return false;
	return SOURCE_EXTS.has(name.slice(dot));
}

function findSourceFiles(dir: string, results: string[] = []): string[] {
	let entries: ReturnType<typeof readdirSync>;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return results;
	}
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			findSourceFiles(full, results);
		} else if (entry.isFile() && isProductionSourceFile(entry.name)) {
			results.push(full);
		}
	}
	return results;
}

const allFiles = SCAN_ROOTS.flatMap((root) => findSourceFiles(resolve(repoRoot, root)));

describe("no Math.random() in production source paths", () => {
	it("finds production source files to scan", () => {
		expect(allFiles.length).toBeGreaterThan(0);
	});

	it("contains no Math.random references", () => {
		const offenders: string[] = [];
		for (const file of allFiles) {
			const content = readFileSync(file, "utf8");
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line === undefined) continue;
				if (line.includes("Math.random")) {
					offenders.push(`${file.slice(repoRoot.length + 1)}:${i + 1}: ${line.trim()}`);
				}
			}
		}
		expect(
			offenders,
			`Math.random() found in production source — replace with crypto.getRandomValues:\n${offenders.join("\n")}`,
		).toEqual([]);
	});
});
