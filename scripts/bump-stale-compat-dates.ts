#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const THRESHOLD_DAYS = 90;
const MS_PER_DAY = 86_400_000;
const DATE_FIELD_RE = /("compatibility_date"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/;

const checkOnly = process.argv.includes("--check");
const today = new Date().toISOString().slice(0, 10);
const todayMs = Date.parse(today);

const files = execSync('find apps packages -name wrangler.jsonc -not -path "*/node_modules/*"', {
	encoding: "utf8",
})
	.trim()
	.split("\n")
	.filter(Boolean);

if (files.length === 0) {
	console.error("No wrangler.jsonc files found under apps/ or packages/");
	process.exit(1);
}

interface Result {
	file: string;
	current: string;
	ageDays: number;
	stale: boolean;
	bumped: boolean;
}

const results: Result[] = [];

for (const file of files) {
	const content = readFileSync(file, "utf8");
	const match = content.match(DATE_FIELD_RE);
	if (!match) {
		console.warn(`::warning file=${file}::no compatibility_date found`);
		continue;
	}
	const current = match[2] as string;
	const ageDays = Math.floor((todayMs - Date.parse(current)) / MS_PER_DAY);
	const stale = ageDays > THRESHOLD_DAYS;
	let bumped = false;

	if (stale && !checkOnly) {
		writeFileSync(file, content.replace(DATE_FIELD_RE, `$1${today}$3`));
		bumped = true;
	}

	results.push({ file, current, ageDays, stale, bumped });
	const status = stale ? (bumped ? "BUMPED" : "STALE") : "OK";
	console.log(`${status.padEnd(7)} ${file}: ${current} (${ageDays}d old)`);
}

const stale = results.filter((r) => r.stale);
const bumped = results.filter((r) => r.bumped);

if (process.env.GITHUB_OUTPUT) {
	const summaryLines = bumped.map(
		(r) => `- \`${r.file}\`: \`${r.current}\` → \`${today}\` (${r.ageDays}d old)`,
	);
	appendFileSync(process.env.GITHUB_OUTPUT, `changed=${bumped.length > 0}\n`);
	appendFileSync(
		process.env.GITHUB_OUTPUT,
		`summary<<__EOF__\n${summaryLines.join("\n")}\n__EOF__\n`,
	);
}

if (checkOnly && stale.length > 0) {
	console.error(
		`\n${stale.length} file(s) have compatibility_date older than ${THRESHOLD_DAYS} days`,
	);
	process.exit(1);
}

console.log(`\n${results.length} file(s) checked, ${stale.length} stale, ${bumped.length} bumped`);
