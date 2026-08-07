/**
 * Runs in the Workers runtime. The rate limiter's state lives in the platform's
 * limiter binding, so a Node test would be asserting against a stub of the very
 * thing under test.
 */

import { env } from "cloudflare:workers";
import { RATE_LIMIT_POLICY } from "@repo/data-ops/rate-limit";
import { describe, expect, it } from "vitest";
import { withRateLimit } from "./rate-limit";

function serverFnRule() {
	const found = RATE_LIMIT_POLICY.find((r) => r.id === "ua:server-fn");
	if (!found) throw new Error("the policy no longer declares ua:server-fn");
	return found;
}

const RULE = serverFnRule();

const rendered = () => new Response("<html>app</html>", { status: 200 });

const serverFnRequest = (headers: Record<string, string>) =>
	new Request("https://app.example.com/_serverFn/getClients", { method: "POST", headers });

const call = (headers: Record<string, string>) =>
	withRateLimit(serverFnRequest(headers), env as unknown as Record<string, unknown>, async () =>
		rendered(),
	);

function randIp() {
	const o = () => Math.floor(Math.random() * 250) + 1;
	return `10.${o()}.${o()}.${o()}`;
}

async function spendBudget(headers: Record<string, string>) {
	for (let i = 0; i < RULE.limit; i++) {
		const res = await call(headers);
		expect(res.status, `request #${i + 1} should pass`).toBe(200);
	}
}

describe("withRateLimit", () => {
	it("lets an unmetered path straight through to the app", async () => {
		const res = await withRateLimit(
			new Request("https://app.example.com/assets/app.css"),
			env as unknown as Record<string, unknown>,
			async () => rendered(),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
	});

	it("reports the policy's budget on allowed responses", async () => {
		const res = await call({ "cf-connecting-ip": randIp() });

		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe(String(RULE.limit));
		expect(res.headers.get("X-RateLimit-Reset")).toBe(String(RULE.period));
	});

	it("throttles a server-function caller past the policy's threshold", async () => {
		const headers = { "cf-connecting-ip": randIp() };
		await spendBudget(headers);

		const blocked = await call(headers);
		expect(blocked.status).toBe(429);
	});

	it("returns the same throttled body the API returns, field for field", async () => {
		const headers = { "cf-connecting-ip": randIp() };
		await spendBudget(headers);

		const blocked = await call(headers);

		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("Content-Type")).toContain("application/json");
		expect(await blocked.json()).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
			retryAfter: RULE.period,
		});
		expect(blocked.headers.get("Retry-After")).toBe(String(RULE.period));
		expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
	});

	it("does not render the app once a caller is throttled", async () => {
		const headers = { "cf-connecting-ip": randIp() };
		await spendBudget(headers);

		let rendersAfterThrottle = 0;
		const res = await withRateLimit(
			serverFnRequest(headers),
			env as unknown as Record<string, unknown>,
			async () => {
				rendersAfterThrottle++;
				return rendered();
			},
		);

		expect(res.status).toBe(429);
		expect(rendersAfterThrottle).toBe(0);
	});

	it("gives two sessions independent budgets", async () => {
		const spent = { cookie: "better-auth.session_token=ua-session-spent" };
		await spendBudget(spent);
		expect((await call(spent)).status).toBe(429);

		const fresh = { cookie: "better-auth.session_token=ua-session-fresh" };
		expect((await call(fresh)).status).toBe(200);
	});

	it("does not let a session reset its budget by moving address", async () => {
		const cookie = "better-auth.session_token=ua-session-roaming";
		await spendBudget({ cookie, "cf-connecting-ip": "203.0.113.10" });

		const fromElsewhere = await call({ cookie, "cf-connecting-ip": "198.51.100.77" });
		expect(fromElsewhere.status).toBe(429);
	});

	it("does not let an address reset its budget by discarding cookies", async () => {
		const ip = randIp();
		await spendBudget({ "cf-connecting-ip": ip });
		expect((await call({ "cf-connecting-ip": ip })).status).toBe(429);

		expect((await call({ "cf-connecting-ip": ip, cookie: "theme=dark" })).status).toBe(429);
	});

	it("gives two anonymous addresses independent budgets", async () => {
		const spent = randIp();
		await spendBudget({ "cf-connecting-ip": spent });
		expect((await call({ "cf-connecting-ip": spent })).status).toBe(429);

		expect((await call({ "cf-connecting-ip": randIp() })).status).toBe(200);
	});
});
