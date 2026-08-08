/**
 * Guardrail: consumers type-check against data-ops source, deploy against its build.
 *
 * Type-checking a consumer against `dist/` means a schema edit is invisible
 * until someone remembers to rebuild — and "remember to rebuild" is not a
 * property of a build system, it is a note taped to one. The fix is a custom
 * export condition that only TypeScript is told to apply, so `tsc` and the
 * editor read `src/` while every bundler, test runner and deploy keeps taking
 * the `default` entry and gets `dist/`.
 *
 * That split is the thing worth pinning, and it fails in both directions: lose
 * the condition and the stale-types problem returns, or promote it to a
 * condition bundlers honour and a deploy starts shipping unbuilt TypeScript.
 * These tests ask TypeScript itself where a specifier lands rather than reading
 * the config back, so they answer the question a contributor actually has.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function compilerOptionsOf(consumerDir: string): ts.CompilerOptions {
	const configPath = resolve(repoRoot, consumerDir, "tsconfig.json");
	const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
	if (error) throw new Error(`could not read ${configPath}`);
	return ts.parseJsonConfigFileContent(config, ts.sys, resolve(repoRoot, consumerDir)).options;
}

/** Where TypeScript, configured exactly as this consumer is, sends a specifier. */
function resolveAsConsumer(consumerDir: string, specifier: string): string {
	const options = compilerOptionsOf(consumerDir);
	const containingFile = resolve(repoRoot, consumerDir, "src/__resolution-probe__.ts");
	const resolved = ts.resolveModuleName(specifier, containingFile, options, ts.sys).resolvedModule;

	expect(resolved, `${consumerDir} could not resolve "${specifier}" at all`).toBeDefined();
	return (resolved as ts.ResolvedModuleFull).resolvedFileName;
}

const CONSUMERS = ["apps/data-service", "apps/user-application"];
const SPECIFIERS = ["@repo/data-ops/client", "@repo/data-ops/database/setup"];

describe("consumers type-check against data-ops source", () => {
	for (const consumer of CONSUMERS) {
		for (const specifier of SPECIFIERS) {
			it(`${consumer}: "${specifier}" resolves into packages/data-ops/src`, () => {
				const resolved = resolveAsConsumer(consumer, specifier);

				expect(
					resolved.startsWith(resolve(repoRoot, "packages/data-ops/src")),
					`${consumer} resolves ${specifier} to ${resolved} — a schema edit stays invisible until someone rebuilds`,
				).toBe(true);
				expect(resolved.endsWith(".ts")).toBe(true);
				expect(resolved).not.toContain(`${resolve(repoRoot, "packages/data-ops/dist")}`);
			});
		}
	}
});

/** What a bundler, a test runner, or a published consumer sees: no custom condition. */
function resolveWithoutCondition(consumerDir: string, specifier: string): string {
	const options = { ...compilerOptionsOf(consumerDir), customConditions: undefined };
	const containingFile = resolve(repoRoot, consumerDir, "src/__resolution-probe__.ts");
	const resolved = ts.resolveModuleName(specifier, containingFile, options, ts.sys).resolvedModule;

	expect(resolved, `${consumerDir} could not resolve "${specifier}" at all`).toBeDefined();
	return (resolved as ts.ResolvedModuleFull).resolvedFileName;
}

describe("everything that runs or ships still resolves the build", () => {
	for (const specifier of SPECIFIERS) {
		it(`"${specifier}" resolves to dist for a consumer that does not opt in`, () => {
			const resolved = resolveWithoutCondition("apps/user-application", specifier);

			expect(
				resolved.startsWith(resolve(repoRoot, "packages/data-ops/dist")),
				`without the custom condition ${specifier} resolved to ${resolved} — a deploy would ship unbuilt TypeScript`,
			).toBe(true);
		});
	}

	it("keeps every export subpath backed by dist under types and default", () => {
		const manifest = JSON.parse(
			readFileSync(resolve(repoRoot, "packages/data-ops/package.json"), "utf8"),
		) as {
			exports: Record<string, Record<string, string>>;
		};

		for (const [subpath, conditions] of Object.entries(manifest.exports)) {
			expect(conditions.types, `${subpath} must keep a dist-backed types entry`).toMatch(
				/^\.\/dist\//,
			);
			expect(conditions.default, `${subpath} must keep a dist-backed default entry`).toMatch(
				/^\.\/dist\//,
			);
		}
	});

	it("puts the source condition ahead of the fallbacks, or nothing would ever pick it", () => {
		const manifest = JSON.parse(
			readFileSync(resolve(repoRoot, "packages/data-ops/package.json"), "utf8"),
		) as {
			exports: Record<string, Record<string, string>>;
		};

		for (const [subpath, conditions] of Object.entries(manifest.exports)) {
			expect(Object.keys(conditions)[0], `${subpath} must list @repo/source first`).toBe(
				"@repo/source",
			);
		}
	});
});
