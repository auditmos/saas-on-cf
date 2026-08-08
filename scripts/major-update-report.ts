/**
 * Reports the dependency updates the weekly bot is deliberately built to skip.
 *
 * `taze` runs in minor mode, which treats a pre-1.0 minor bump as breaking —
 * correct, and the reason those bumps never land automatically. The cost is
 * that they never surface either: a package can sit majors behind with nothing
 * scheduled to say so. This lane reports; it does not upgrade. The decision to
 * take a breaking change stays a human one.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export interface OutdatedEntry {
	current: string;
	latest: string;
	dependentPackages?: { name: string; location: string }[];
}

export type UpdateKind = "major" | "pre-1.0";

export interface FrozenUpdate {
	name: string;
	current: string;
	latest: string;
	kind: UpdateKind;
	packages: string[];
}

function partsOf(version: string): { major: number; minor: number } | null {
	const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
	if (major === undefined || Number.isNaN(major)) return null;
	return { major, minor: minor === undefined || Number.isNaN(minor) ? 0 : minor };
}

/**
 * Null when the bump is one the weekly minor-and-patch bot already handles.
 * Below 1.0 semver puts the breaking signal in the minor position, which is
 * why a 0.x minor belongs here and a 0.x patch does not.
 */
function classify(current: string, latest: string): UpdateKind | null {
	const from = partsOf(current);
	const to = partsOf(latest);
	if (!from || !to) return null;
	if (to.major > from.major) return "major";
	if (from.major === 0 && to.major === 0 && to.minor > from.minor) return "pre-1.0";
	return null;
}

export function findFrozenUpdates(outdated: Record<string, OutdatedEntry>): FrozenUpdate[] {
	const updates: FrozenUpdate[] = [];

	for (const [name, entry] of Object.entries(outdated)) {
		const kind = classify(entry.current, entry.latest);
		if (!kind) continue;
		updates.push({
			name,
			current: entry.current,
			latest: entry.latest,
			kind,
			packages: (entry.dependentPackages ?? []).map((p) => p.name),
		});
	}

	return updates;
}

export interface Report {
	title: string;
	body: string;
	count: number;
	/** Identifies the outstanding set, so a re-run can tell "same news" from "new news". */
	fingerprint: string;
}

const FINGERPRINT_MARKER = "deps-frozen-report";

function fingerprintOf(updates: FrozenUpdate[]): string {
	const canonical = updates
		.map((u) => `${u.name}@${u.current}->${u.latest}`)
		.sort()
		.join("|");
	return createHash("sha256").update(canonical).digest("hex").slice(0, 12);
}

const KIND_LABEL: Record<UpdateKind, string> = {
	major: "major",
	"pre-1.0": "pre-1.0 minor",
};

export function renderReport(updates: FrozenUpdate[]): Report {
	const fingerprint = fingerprintOf(updates);
	const sorted = [...updates].sort((a, b) => a.name.localeCompare(b.name));
	const rows = sorted.map(
		(u) =>
			`| \`${u.name}\` | \`${u.current}\` | \`${u.latest}\` | ${KIND_LABEL[u.kind]} | ${
				u.packages.length > 0 ? u.packages.map((p) => `\`${p}\``).join(", ") : "—"
			} |`,
	);

	const body = [
		`<!-- ${FINGERPRINT_MARKER}:${fingerprint} -->`,
		"",
		`${sorted.length} dependenc${sorted.length === 1 ? "y is" : "ies are"} held back by the weekly bot's update policy.`,
		"",
		"| Package | Current | Latest | Kind | Used by |",
		"| --- | --- | --- | --- | --- |",
		...rows,
		"",
		"## Why these are not bumped automatically",
		"",
		"The weekly `Deps update` job runs `taze` in minor mode, which treats a",
		"pre-1.0 minor as breaking. That is the right default — loosening it would",
		"auto-merge breaking changes — so these updates need a human to take them.",
		"",
		"## How to take one",
		"",
		"```bash",
		"pnpm run deps:major        # review what major mode would change",
		"pnpm run deps:major:update # write the bumps, then read the changelogs",
		"pnpm install && pnpm run lint:ci && pnpm run types && pnpm run test && pnpm run knip",
		"```",
		"",
		"This issue is rewritten in place as the set changes, and closed once it empties.",
	].join("\n");

	return {
		title: "chore(deps): major + pre-1.0 updates awaiting review",
		body,
		count: sorted.length,
		fingerprint,
	};
}

export interface OpenReport {
	number: number;
	body: string;
}

export type IssueAction =
	| { action: "none" }
	| { action: "create" }
	| { action: "update"; issue: number }
	| { action: "skip"; issue: number }
	| { action: "close"; issue: number };

function fingerprintIn(body: string): string | null {
	return new RegExp(`${FINGERPRINT_MARKER}:([0-9a-f]+)`).exec(body)?.[1] ?? null;
}

/**
 * One tracking issue, rewritten in place. A job that opens a fresh issue every
 * week teaches people to ignore it, which is the same outcome as not running.
 */
export function planIssueAction(open: OpenReport[], report: Report): IssueAction {
	const existing = open[0];
	if (!existing) return report.count === 0 ? { action: "none" } : { action: "create" };
	if (report.count === 0) return { action: "close", issue: existing.number };
	return fingerprintIn(existing.body) === report.fingerprint
		? { action: "skip", issue: existing.number }
		: { action: "update", issue: existing.number };
}

// ---------------------------------------------------------------------------
// Executable shell: everything above is pure and tested, everything below talks
// to pnpm and gh.
// ---------------------------------------------------------------------------

class ReportError extends Error {
	constructor(
		public readonly step: string,
		message: string,
	) {
		super(message);
		this.name = "ReportError";
	}
}

const ISSUE_LABELS = ["dependencies", "automated"];

/** `pnpm outdated` exits 1 precisely when it has something to say. */
function readOutdated(): Record<string, OutdatedEntry> {
	let stdout: string;
	try {
		stdout = execFileSync("pnpm", ["outdated", "-r", "--format", "json"], {
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		});
	} catch (error) {
		const withOutput = error as { stdout?: string };
		if (typeof withOutput.stdout !== "string") {
			throw new ReportError("pnpm outdated", (error as Error).message);
		}
		stdout = withOutput.stdout;
	}

	const trimmed = stdout.trim();
	if (trimmed === "") return {};

	try {
		return JSON.parse(trimmed) as Record<string, OutdatedEntry>;
	} catch {
		throw new ReportError("pnpm outdated", "output was not JSON");
	}
}

function gh(args: string[], input?: string): string {
	try {
		return execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
	} catch (error) {
		const withOutput = error as { stderr?: string };
		throw new ReportError(`gh ${args[0] ?? ""}`, withOutput.stderr || (error as Error).message);
	}
}

function findOpenReports(title: string): OpenReport[] {
	const listed = JSON.parse(
		gh([
			"issue",
			"list",
			"--state",
			"open",
			...ISSUE_LABELS.flatMap((label) => ["--label", label]),
			"--json",
			"number,title,body",
			"--limit",
			"100",
		]),
	) as { number: number; title: string; body: string }[];

	return listed.filter((issue) => issue.title === title);
}

function main(): void {
	const dryRun = process.argv.includes("--dry-run");
	const report = renderReport(findFrozenUpdates(readOutdated()));

	console.log(`${report.count} update(s) held back — fingerprint ${report.fingerprint}`);

	if (dryRun) {
		console.log(`\n--- ${report.title} ---\n${report.body}`);
		return;
	}

	const plan = planIssueAction(findOpenReports(report.title), report);

	switch (plan.action) {
		case "none":
			console.log("Nothing held back and no tracking issue open.");
			return;
		case "skip":
			console.log(`Issue #${plan.issue} already reports this exact set.`);
			return;
		case "create": {
			const url = gh(
				[
					"issue",
					"create",
					"--title",
					report.title,
					"--body-file",
					"-",
					...ISSUE_LABELS.flatMap((label) => ["--label", label]),
				],
				report.body,
			).trim();
			console.log(`Opened ${url}`);
			return;
		}
		case "update":
			gh(["issue", "edit", String(plan.issue), "--body-file", "-"], report.body);
			console.log(`Rewrote issue #${plan.issue} with the current set.`);
			return;
		case "close":
			gh([
				"issue",
				"close",
				String(plan.issue),
				"--comment",
				"Every major and pre-1.0 update reported here has landed. Reopened automatically if another appears.",
			]);
			console.log(`Closed issue #${plan.issue}.`);
			return;
	}
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	try {
		main();
	} catch (error) {
		if (error instanceof ReportError) {
			console.error(`${error.step} failed: ${error.message}`);
			process.exit(1);
		}
		throw error;
	}
}
