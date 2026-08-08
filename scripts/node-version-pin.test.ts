/**
 * Guardrail: one Node version, honoured everywhere.
 *
 * Unpinned, each place that runs Node picks its own: a contributor's shell has
 * whatever they installed, `actions/setup-node` with `lts/*` follows the LTS
 * line as it moves, and a platform build takes its own default. They agree
 * until an LTS transition, and then they disagree in CI on a change that has
 * nothing to do with Node.
 *
 * `.node-version` is the pin because it is the file the widest set of tools
 * already reads — fnm, nodenv, asdf, `actions/setup-node` via
 * `node-version-file`, and Cloudflare's build images. `engines` states the same
 * constraint as a range for pnpm.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

function read(relativePath: string): string {
	return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

const pinned = read(".node-version").trim();

describe("Node version pin", () => {
	it("names a concrete version, not a moving alias", () => {
		expect(pinned, "`.node-version` must name a version like 24.18.0").toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("is echoed by the engines range, so pnpm enforces the same major", () => {
		const { engines } = JSON.parse(read("package.json")) as { engines?: { node?: string } };
		const major = pinned.split(".")[0];

		expect(engines?.node, "root package.json must declare engines.node").toBeDefined();
		expect(
			engines?.node,
			`engines.node must constrain to the major in .node-version (${major})`,
		).toContain(major as string);
	});
});

const workflowDir = resolve(repoRoot, ".github/workflows");
const workflows = readdirSync(workflowDir).filter((name) => name.endsWith(".yml"));

describe("CI honours the pin", () => {
	it("finds workflows to check", () => {
		expect(workflows.length).toBeGreaterThan(0);
	});

	for (const workflow of workflows) {
		const source = readFileSync(join(workflowDir, workflow), "utf8");
		if (!source.includes("actions/setup-node")) continue;

		it(`${workflow}: takes its Node version from .node-version`, () => {
			expect(source).toContain("node-version-file: .node-version");
		});

		it(`${workflow}: pins no version inline, which would drift from the file`, () => {
			expect(
				/^\s*node-version:/m.test(source),
				`${workflow} sets node-version inline — it will not follow .node-version`,
			).toBe(false);
		});
	}
});
