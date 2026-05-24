import { env } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimiter } from "./rate-limiter";

function buildApp(binding: RateLimit = env.RATE_LIMITER) {
	const app = new Hono<{ Bindings: Env }>();
	app.use("/protected", rateLimiter({ binding, limit: 10, window: 60 }));
	app.get("/protected", (c) => c.text("ok"));
	return app;
}

function ipReq(ip: string) {
	return new Request("http://localhost/protected", {
		headers: { "cf-connecting-ip": ip },
	});
}

function randIp() {
	const o = () => Math.floor(Math.random() * 250) + 1;
	return `10.${o()}.${o()}.${o()}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("rateLimiter middleware", () => {
	it("returns 429 on the 11th request from the same IP within the window", async () => {
		const app = buildApp();
		const ip = randIp();

		for (let i = 0; i < 10; i++) {
			const res = await app.fetch(ipReq(ip), env);
			expect(res.status, `request #${i + 1} should pass`).toBe(200);
		}

		const eleventh = await app.fetch(ipReq(ip), env);
		expect(eleventh.status).toBe(429);
	});

	it("buckets requests with no cf-connecting-ip into one shared 'anonymous' budget", async () => {
		const app = buildApp(env.RATE_LIMITER_FAST);
		const headerless = new Request("http://localhost/protected");

		for (let i = 0; i < 10; i++) {
			const res = await app.fetch(headerless.clone(), env);
			expect(res.status, `anonymous request #${i + 1} should pass`).toBe(200);
		}

		const blocked = await app.fetch(headerless.clone(), env);
		expect(blocked.status).toBe(429);
	}, 15_000);

	it("emits X-RateLimit-* headers on successful responses too", async () => {
		const app = buildApp();
		const res = await app.fetch(ipReq(randIp()), env);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
		expect(res.headers.get("X-RateLimit-Reset")).toBe("60");
	});

	it("emits Retry-After + X-RateLimit-* headers on 429", async () => {
		const app = buildApp();
		const ip = randIp();

		for (let i = 0; i < 10; i++) await app.fetch(ipReq(ip), env);
		const blocked = await app.fetch(ipReq(ip), env);

		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("Retry-After")).toBe("60");
		expect(blocked.headers.get("X-RateLimit-Limit")).toBe("10");
		expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
		expect(blocked.headers.get("X-RateLimit-Reset")).toBe("60");
	});

	it("allows requests again once the window has expired", async () => {
		const app = buildApp(env.RATE_LIMITER_FAST);
		const ip = randIp();

		for (let i = 0; i < 10; i++) await app.fetch(ipReq(ip), env);
		const blocked = await app.fetch(ipReq(ip), env);
		expect(blocked.status).toBe(429);

		await sleep(11_000);

		const after = await app.fetch(ipReq(ip), env);
		expect(after.status).toBe(200);
	}, 20_000);
});
