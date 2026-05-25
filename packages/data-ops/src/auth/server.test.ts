import { drizzle } from "drizzle-orm/neon-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const baseConfig = {
	secret: "test-secret",
	baseURL: "http://localhost",
	adapter: {
		drizzleDb: drizzle("postgres://u:p@localhost/db"),
		provider: "pg" as const,
	},
};

describe("setAuth", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("returns the same instance on repeated calls (idempotent)", async () => {
		const { setAuth } = await import("./server");
		const first = setAuth(baseConfig);
		const second = setAuth(baseConfig);
		expect(second).toBe(first);
	});

	it("getAuth returns the instance set by setAuth", async () => {
		const { setAuth, getAuth } = await import("./server");
		const initialized = setAuth(baseConfig);
		expect(getAuth()).toBe(initialized);
	});

	it("ignores config on subsequent calls (no per-config memoization)", async () => {
		const { setAuth } = await import("./server");
		const first = setAuth(baseConfig);
		const second = setAuth({
			...baseConfig,
			secret: "different-secret",
			baseURL: "http://other-host",
		});
		expect(second).toBe(first);
	});
});
