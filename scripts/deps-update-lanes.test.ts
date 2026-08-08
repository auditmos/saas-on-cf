/**
 * Guardrail: the two dependency lanes stay separate.
 *
 * The weekly bot updates and opens a PR, and it runs in minor mode so a pre-1.0
 * minor — breaking under semver — is never merged unread. The report lane
 * exists because that policy leaves those updates invisible, not because the
 * policy is wrong. Loosening the weekly bot to cover them would auto-merge
 * breaking changes, so the report opens an issue and stops there.
 *
 * Both halves are easy to erode with a one-line edit, in opposite directions:
 * widening taze's mode, or letting the report lane start opening PRs.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function read(relativePath: string): string {
	return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("weekly minor-and-patch lane", () => {
	it("keeps taze in minor mode, so pre-1.0 minors are never auto-merged", () => {
		expect(
			read("taze.config.ts"),
			'taze must stay in minor mode — "latest"/"major" would auto-merge breaking changes',
		).toMatch(/mode:\s*"minor"/);
	});

	it("still opens a pull request", () => {
		expect(read(".github/workflows/deps-update.yml")).toContain("peter-evans/create-pull-request");
	});
});

describe("major and pre-1.0 report lane", () => {
	const workflow = read(".github/workflows/deps-major-report.yml");

	it("runs on a schedule", () => {
		expect(workflow).toMatch(/schedule:\s*\n\s*- cron:/);
	});

	it("runs a script that reaches the report module", () => {
		const invoked = /run:\s*pnpm run ([\w:-]+)/.exec(workflow)?.[1];
		expect(invoked, "the report job must invoke a package script").toBeDefined();

		const { scripts = {} } = JSON.parse(read("package.json")) as {
			scripts?: Record<string, string>;
		};
		expect(scripts[invoked as string]).toContain("scripts/major-update-report.ts");
	});

	it("can write issues", () => {
		expect(workflow).toMatch(/issues:\s*write/);
	});

	it("opens no pull request — the upgrade decision stays human", () => {
		expect(workflow).not.toContain("create-pull-request");
		expect(workflow).not.toMatch(/pull-requests:\s*write/);
	});

	it("never runs an updating taze mode, which would write bumps into the tree", () => {
		expect(workflow).not.toMatch(/deps:(update|major:update)/);
	});
});
