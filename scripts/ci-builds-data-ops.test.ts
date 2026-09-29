/**
 * Guardrail: CI builds data-ops before it runs the tests.
 *
 * Type-checking resolves `@repo/data-ops` to its source, but the test runners
 * resolve it to `dist/`, which is gitignored. A local checkout usually has a
 * stale `dist/` lying around, so a workflow that skips the build passes on
 * every laptop and fails only in CI with `Cannot find package
 * '@repo/data-ops/client'`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const workflowsDir = resolve(repoRoot, ".github/workflows");

const TEST_STEP = /^\s*run:\s*pnpm run test\s*$/m;
const BUILD_STEP = /^\s*run:\s*pnpm run build:data-ops\s*$/m;

const workflowsThatTest = readdirSync(workflowsDir)
	.filter((file) => /\.ya?ml$/.test(file))
	.map((file) => ({ file, text: readFileSync(resolve(workflowsDir, file), "utf8") }))
	.filter(({ text }) => TEST_STEP.test(text));

describe("workflows that run the tests", () => {
	it("exist, so this guardrail is checking something", () => {
		expect(workflowsThatTest.length).toBeGreaterThan(0);
	});

	for (const { file, text } of workflowsThatTest) {
		it(`${file}: builds data-ops before the test step`, () => {
			const build = BUILD_STEP.exec(text)?.index;
			const test = TEST_STEP.exec(text)?.index ?? 0;

			expect(build, `${file} runs the tests without \`pnpm run build:data-ops\``).toBeDefined();
			expect(build ?? Number.POSITIVE_INFINITY).toBeLessThan(test);
		});
	}
});
