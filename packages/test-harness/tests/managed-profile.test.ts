import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDbHandle } from "../src";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.runIf(TEST_DATABASE_URL)("managed profile (Neon)", () => {
	let handle: TestDbHandle;

	beforeEach(() => { vi.stubEnv("TEST_DB_PROFILE", "managed"); });
	afterEach(async () => {
		if (handle) await handle.cleanup();
		vi.unstubAllEnvs();
	});

	it("connects to real Postgres and returns a working drizzle handle", async () => {
		handle = await createTestDb();
		const result = await handle.db.execute(sql`select 1 as one`);
		const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? result;
		expect(Array.isArray(rows) ? rows.length : 0).toBeGreaterThan(0);
	});
});

describe("managed profile - misconfiguration", () => {
	beforeEach(() => {
		vi.stubEnv("TEST_DB_PROFILE", "managed");
		vi.stubEnv("TEST_DATABASE_URL", "");
	});
	afterEach(() => { vi.unstubAllEnvs(); });

	it("throws descriptive error when TEST_DATABASE_URL is missing", async () => {
		await expect(createTestDb()).rejects.toThrow(/TEST_DATABASE_URL/);
	});
});
