import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkHyperdriveDrift } from "./hyperdrive-drift";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");

const SETUP_FILE = resolve(repoRoot, "packages/data-ops/src/database/setup.ts");
const DS_WRANGLER = resolve(repoRoot, "apps/data-service/wrangler.jsonc");
const UA_WRANGLER = resolve(repoRoot, "apps/user-application/wrangler.jsonc");

describe("hyperdrive drift", () => {
	it("passes for the current Neon-based repo state", () => {
		const report = checkHyperdriveDrift({
			setupSource: readFileSync(SETUP_FILE, "utf8"),
			wranglerSources: [
				{ name: "data-service", source: readFileSync(DS_WRANGLER, "utf8") },
				{ name: "user-application", source: readFileSync(UA_WRANGLER, "utf8") },
			],
		});
		expect(
			report.adapter,
			"Neon adapter expected — switch to drizzle-orm/postgres-js or node-postgres requires hyperdrive bindings; see packages/data-ops/AGENTS.md",
		).toBe("neon");
		expect(report.missingHyperdrive).toEqual([]);
	});

	it("reports non-Neon adapter + missing hyperdrive bindings on a synthetic fork", () => {
		const report = checkHyperdriveDrift({
			setupSource: `import { drizzle } from "drizzle-orm/postgres-js";`,
			wranglerSources: [
				{ name: "data-service", source: `{ "name": "ds" }` },
				{ name: "user-application", source: `{ "name": "ua" }` },
			],
		});
		expect(report.adapter).toBe("non-neon");
		expect(report.adapterImport).toBe("drizzle-orm/postgres-js");
		expect(report.missingHyperdrive).toEqual(["data-service", "user-application"]);
	});

	it("passes for non-Neon adapter when both wrangler files declare hyperdrive bindings", () => {
		const report = checkHyperdriveDrift({
			setupSource: `import { drizzle } from "drizzle-orm/postgres-js";`,
			wranglerSources: [
				{
					name: "data-service",
					source: `{
						"name": "ds",
						"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "abc" }]
					}`,
				},
				{
					name: "user-application",
					// Per-env hyperdrive binding (production block) — also acceptable.
					source: `{
						"name": "ua",
						"env": {
							"production": {
								"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "def" }]
							}
						}
					}`,
				},
			],
		});
		expect(report.adapter).toBe("non-neon");
		expect(report.missingHyperdrive).toEqual([]);
	});
});
