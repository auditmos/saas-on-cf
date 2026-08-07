import { env } from "cloudflare:test";
import { RATE_LIMIT_POLICY } from "@repo/data-ops/rate-limit";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimiter } from "./rate-limiter";

const readRule = RATE_LIMIT_POLICY.find((r) => r.id === "ds:clients:read");
if (!readRule) throw new Error("the policy no longer declares ds:clients:read");

function buildApp() {
	const app = new Hono<{ Bindings: Env }>();
	app.use("*", rateLimiter("data-service"));
	app.get("*", (c) => c.text("ok"));
	return app;
}

function req(path: string, ip: string, init: RequestInit = {}) {
	return new Request(`http://localhost${path}`, {
		...init,
		headers: { "cf-connecting-ip": ip, ...init.headers },
	});
}

function randIp() {
	const o = () => Math.floor(Math.random() * 250) + 1;
	return `10.${o()}.${o()}.${o()}`;
}

/** Stands in for the platform limiter so a recovered budget can be observed instantly. */
function budgetOf(allowed: number) {
	let spent = 0;
	return {
		reset: () => {
			spent = 0;
		},
		binding: {
			limit: async () => ({ success: ++spent <= allowed }),
		},
	};
}

describe("rateLimiter middleware", () => {
	it("lets an unmetered path through without touching a limiter", async () => {
		const res = await buildApp().fetch(req("/health/live", randIp()), {} as Env);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
	});

	it("reports the policy's budget on allowed responses", async () => {
		const res = await buildApp().fetch(req("/clients", randIp()), env);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe(String(readRule.limit));
		expect(res.headers.get("X-RateLimit-Reset")).toBe(String(readRule.period));
	});

	it("returns the policy's throttled response once the budget is spent", async () => {
		const app = buildApp();
		const ip = randIp();

		for (let i = 0; i < readRule.limit; i++) {
			const res = await app.fetch(req("/clients", ip), env);
			expect(res.status, `request #${i + 1} should pass`).toBe(200);
		}

		const blocked = await app.fetch(req("/clients", ip), env);

		expect(blocked.status).toBe(429);
		expect(await blocked.json()).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
			retryAfter: readRule.period,
		});
		expect(blocked.headers.get("Retry-After")).toBe(String(readRule.period));
		expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
	});

	it("asks the platform on every request rather than caching the verdict", async () => {
		const app = buildApp();
		const budget = budgetOf(1);
		const testEnv = { ...env, [readRule.binding]: budget.binding } as unknown as Env;
		const ip = randIp();

		expect((await app.fetch(req("/clients", ip), testEnv)).status).toBe(200);
		expect((await app.fetch(req("/clients", ip), testEnv)).status).toBe(429);

		budget.reset();

		expect((await app.fetch(req("/clients", ip), testEnv)).status).toBe(200);
	});

	it("takes no threshold from its caller — only the Worker it is running in", () => {
		expect(rateLimiter.length).toBe(1);
	});
});
