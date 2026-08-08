import { describe, expect, it } from "vitest";
import {
	type FrozenUpdate,
	findFrozenUpdates,
	planIssueAction,
	renderReport,
} from "./major-update-report";

function update(overrides: Partial<FrozenUpdate> = {}): FrozenUpdate {
	return {
		name: "hono",
		current: "4.12.34",
		latest: "5.0.1",
		kind: "major",
		packages: ["data-service"],
		...overrides,
	};
}

describe("findFrozenUpdates", () => {
	it("reports a dependency whose latest release is a new major", () => {
		const updates = findFrozenUpdates({
			hono: {
				current: "4.12.34",
				latest: "5.0.1",
				dependentPackages: [{ name: "data-service", location: "/repo/apps/data-service" }],
			},
		});

		expect(updates).toEqual([
			{
				name: "hono",
				current: "4.12.34",
				latest: "5.0.1",
				kind: "major",
				packages: ["data-service"],
			},
		]);
	});

	it("leaves same-major minor and patch bumps to the weekly bot", () => {
		const updates = findFrozenUpdates({
			"@tanstack/react-router": { current: "1.170.18", latest: "1.170.23" },
			"better-auth": { current: "1.6.25", latest: "1.7.0" },
		});

		expect(updates).toEqual([]);
	});

	// The reason this lane exists: under semver a 0.x minor is a breaking
	// change, so minor mode refuses it, and nothing else was looking.
	it("reports a pre-1.0 minor bump, which minor mode refuses as breaking", () => {
		const updates = findFrozenUpdates({
			"@cloudflare/vitest-pool-workers": { current: "0.16.20", latest: "0.17.3" },
		});

		expect(updates).toEqual([
			{
				name: "@cloudflare/vitest-pool-workers",
				current: "0.16.20",
				latest: "0.17.3",
				kind: "pre-1.0",
				packages: [],
			},
		]);
	});

	it("leaves pre-1.0 patch bumps to the weekly bot", () => {
		expect(findFrozenUpdates({ taze: { current: "0.19.2", latest: "0.19.9" } })).toEqual([]);
	});
});

describe("renderReport", () => {
	it("names every outstanding update with its current and latest version", () => {
		const { body } = renderReport([
			update(),
			update({ name: "taze", current: "0.19.2", latest: "0.20.0", kind: "pre-1.0", packages: [] }),
		]);

		expect(body).toContain("hono");
		expect(body).toContain("4.12.34");
		expect(body).toContain("5.0.1");
		expect(body).toContain("taze");
		expect(body).toContain("0.20.0");
	});

	it("fingerprints the outstanding set independently of scan order", () => {
		const a = update();
		const b = update({ name: "taze", current: "0.19.2", latest: "0.20.0", kind: "pre-1.0" });

		expect(renderReport([a, b]).fingerprint).toBe(renderReport([b, a]).fingerprint);
	});

	it("changes the fingerprint when a newer release becomes available", () => {
		const before = renderReport([update({ latest: "5.0.1" })]).fingerprint;
		const after = renderReport([update({ latest: "5.1.0" })]).fingerprint;

		expect(after).not.toBe(before);
	});
});

describe("planIssueAction", () => {
	const report = renderReport([update()]);

	it("opens a tracking issue when none is outstanding", () => {
		expect(planIssueAction([], report)).toEqual({ action: "create" });
	});

	it("does nothing on a re-run against the same outstanding set", () => {
		const open = [{ number: 12, body: report.body }];

		expect(planIssueAction(open, report)).toEqual({ action: "skip", issue: 12 });
	});

	it("rewrites the existing issue rather than opening a second one", () => {
		const stale = renderReport([update({ latest: "4.99.0" })]);
		const open = [{ number: 12, body: stale.body }];

		expect(planIssueAction(open, report)).toEqual({ action: "update", issue: 12 });
	});

	it("closes the tracking issue once nothing is held back", () => {
		const open = [{ number: 12, body: report.body }];

		expect(planIssueAction(open, renderReport([]))).toEqual({ action: "close", issue: 12 });
	});

	it("stays quiet when nothing is held back and nothing is open", () => {
		expect(planIssueAction([], renderReport([]))).toEqual({ action: "none" });
	});
});
