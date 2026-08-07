import { describe, expect, it } from "vitest";
import {
	callerFromRequest,
	deriveRateLimitKey,
	enforceRateLimit,
	RATE_LIMIT_POLICY,
	RateLimitConfigError,
	type RateLimitRule,
	rateLimitHeaders,
	resolveRateLimitRule,
	throttledResponse,
} from "./policy";

const anyRule = (): RateLimitRule => {
	const rule = RATE_LIMIT_POLICY[0];
	if (!rule) throw new Error("the policy declares no rules");
	return rule;
};

describe("deriveRateLimitKey", () => {
	it("gives two distinct sessions independent budgets", async () => {
		const rule = anyRule();
		const a = await deriveRateLimitKey(rule, { sessionToken: "session-a" });
		const b = await deriveRateLimitKey(rule, { sessionToken: "session-b" });

		expect(a).not.toBe(b);
	});

	it("gives two anonymous callers at distinct addresses independent budgets", async () => {
		const rule = anyRule();
		const a = await deriveRateLimitKey(rule, { address: "203.0.113.1" });
		const b = await deriveRateLimitKey(rule, { address: "203.0.113.2" });

		expect(a).not.toBe(b);
	});

	it("does not let a session evade its limit by varying address", async () => {
		const rule = anyRule();
		const fromHome = await deriveRateLimitKey(rule, {
			sessionToken: "session-a",
			address: "203.0.113.1",
		});
		const fromCafe = await deriveRateLimitKey(rule, {
			sessionToken: "session-a",
			address: "198.51.100.9",
		});

		expect(fromHome).toBe(fromCafe);
	});

	it("does not let an address evade its limit by discarding cookies", async () => {
		const rule = anyRule();
		const withStaleCookie = await deriveRateLimitKey(rule, {
			sessionToken: null,
			address: "203.0.113.1",
		});
		const withNoCookieAtAll = await deriveRateLimitKey(rule, { address: "203.0.113.1" });

		expect(withStaleCookie).toBe(withNoCookieAtAll);
	});

	it("never carries the raw session token, which is a credential", async () => {
		const rule = anyRule();
		const key = await deriveRateLimitKey(rule, { sessionToken: "super-secret-token" });

		expect(key).not.toContain("super-secret-token");
	});

	it("keeps each rule's budget separate, so one route cannot spend another's", async () => {
		const [first, second] = RATE_LIMIT_POLICY;
		if (!first || !second) throw new Error("the policy needs at least two rules to compare");

		expect(await deriveRateLimitKey(first, { address: "203.0.113.1" })).not.toBe(
			await deriveRateLimitKey(second, { address: "203.0.113.1" }),
		);
	});

	it("buckets callers with neither session nor address together rather than exempting them", async () => {
		const rule = anyRule();
		const key = await deriveRateLimitKey(rule, {});

		expect(key).toBeTruthy();
		expect(key).toBe(await deriveRateLimitKey(rule, { address: null, sessionToken: null }));
	});
});

describe("callerFromRequest", () => {
	it("reads the client address from cf-connecting-ip", () => {
		const caller = callerFromRequest(
			new Request("https://api.example.com/clients", {
				headers: { "cf-connecting-ip": "203.0.113.7" },
			}),
		);

		expect(caller.address).toBe("203.0.113.7");
	});

	it("reads the Better Auth session cookie", () => {
		const caller = callerFromRequest(
			new Request("https://api.example.com/clients", {
				headers: { cookie: "theme=dark; better-auth.session_token=abc.def; other=1" },
			}),
		);

		expect(caller.sessionToken).toBe("abc.def");
	});

	it("reads the __Secure- prefixed cookie Better Auth sets over HTTPS", () => {
		const caller = callerFromRequest(
			new Request("https://api.example.com/clients", {
				headers: { cookie: "__Secure-better-auth.session_token=xyz" },
			}),
		);

		expect(caller.sessionToken).toBe("xyz");
	});

	it("reports no session when the request carries no cookie", () => {
		const caller = callerFromRequest(new Request("https://api.example.com/clients"));

		expect(caller.sessionToken).toBeNull();
	});
});

describe("resolveRateLimitRule", () => {
	it("matches the client list endpoint on the API", () => {
		const rule = resolveRateLimitRule("data-service", "GET", "/clients");

		expect(rule?.worker).toBe("data-service");
		expect(rule?.methods).toContain("GET");
	});

	it("matches the client detail endpoint on the API", () => {
		expect(resolveRateLimitRule("data-service", "GET", "/clients/abc")).toBeDefined();
	});

	it("resolves mutations to a different rule than reads", () => {
		const read = resolveRateLimitRule("data-service", "GET", "/clients");
		const write = resolveRateLimitRule("data-service", "POST", "/clients");

		expect(read).toBeDefined();
		expect(write).toBeDefined();
		expect(read?.id).not.toBe(write?.id);
	});

	it("does not meter health probes", () => {
		expect(resolveRateLimitRule("data-service", "GET", "/health/live")).toBeUndefined();
	});

	it("does not apply one Worker's rules to the other", () => {
		expect(resolveRateLimitRule("user-application", "GET", "/clients")).toBeUndefined();
	});

	it("matches the frontend's server-function endpoint", () => {
		expect(resolveRateLimitRule("user-application", "POST", "/_serverFn/abc")).toBeDefined();
	});

	it("does not meter the frontend's static asset paths", () => {
		expect(resolveRateLimitRule("user-application", "GET", "/assets/app.css")).toBeUndefined();
	});

	it("does not treat a path that merely starts with the same characters as a match", () => {
		expect(resolveRateLimitRule("data-service", "GET", "/clientsomething")).toBeUndefined();
	});
});

/**
 * The platform limiter is a system boundary, so it is stubbed. `spent` records
 * every key it was asked about, which is how the tests below observe that key
 * derivation reached the binding intact.
 */
function fakeLimiter(allowFirst: number) {
	const spent: string[] = [];
	return {
		spent,
		binding: {
			limit: async ({ key }: { key: string }) => {
				spent.push(key);
				return { success: spent.filter((k) => k === key).length <= allowFirst };
			},
		},
	};
}

const readRule = (): RateLimitRule => {
	const rule = RATE_LIMIT_POLICY.find((r) => r.id === "ds:clients:read");
	if (!rule) throw new Error("the policy no longer declares ds:clients:read");
	return rule;
};

describe("throttledResponse", () => {
	it("answers 429 with a JSON body naming the condition", async () => {
		const response = throttledResponse(readRule());

		expect(response.status).toBe(429);
		expect(response.headers.get("Content-Type")).toContain("application/json");
		expect(await response.json()).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
			retryAfter: readRule().period,
		});
	});

	it("tells the caller when to come back", () => {
		const rule = readRule();
		const response = throttledResponse(rule);

		expect(response.headers.get("Retry-After")).toBe(String(rule.period));
		expect(response.headers.get("X-RateLimit-Limit")).toBe(String(rule.limit));
		expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
		expect(response.headers.get("X-RateLimit-Reset")).toBe(String(rule.period));
	});

	it("reports the same body shape for every rule, whichever Worker owns it", async () => {
		const shapes = await Promise.all(
			RATE_LIMIT_POLICY.map(async (rule) =>
				Object.keys((await throttledResponse(rule).json()) as object).sort(),
			),
		);

		for (const shape of shapes) {
			expect(shape).toEqual(["code", "error", "retryAfter"]);
		}
	});
});

describe("rateLimitHeaders", () => {
	it("reports the budget on allowed requests too, so a caller can pace itself", () => {
		const rule = readRule();

		expect(rateLimitHeaders(rule)).toEqual({
			"X-RateLimit-Limit": String(rule.limit),
			"X-RateLimit-Reset": String(rule.period),
		});
	});
});

describe("enforceRateLimit", () => {
	const listRequest = (headers: Record<string, string> = {}) =>
		new Request("https://api.example.com/clients?limit=10", { headers });

	it("reports an unmetered path rather than inventing a limit for it", async () => {
		const outcome = await enforceRateLimit({
			worker: "data-service",
			request: new Request("https://api.example.com/health/live"),
			env: {},
		});

		expect(outcome.metered).toBe(false);
	});

	it("allows a request inside the budget and names the rule that let it through", async () => {
		const { binding } = fakeLimiter(1);
		const outcome = await enforceRateLimit({
			worker: "data-service",
			request: listRequest({ "cf-connecting-ip": "203.0.113.1" }),
			env: { RATE_LIMITER_READS: binding },
		});

		expect(outcome).toMatchObject({ metered: true, allowed: true });
		expect(outcome.metered && outcome.rule.id).toBe("ds:clients:read");
	});

	it("throttles once the budget is spent", async () => {
		const { binding } = fakeLimiter(1);
		const env = { RATE_LIMITER_READS: binding };
		const request = () => listRequest({ "cf-connecting-ip": "203.0.113.1" });

		expect(
			(await enforceRateLimit({ worker: "data-service", request: request(), env })).metered && true,
		).toBe(true);
		const second = await enforceRateLimit({ worker: "data-service", request: request(), env });

		expect(second).toMatchObject({ metered: true, allowed: false });
		if (second.metered && !second.allowed) {
			expect(second.response.status).toBe(429);
		}
	});

	it("spends one session's budget regardless of the address it arrives from", async () => {
		const { binding, spent } = fakeLimiter(10);
		const env = { RATE_LIMITER_READS: binding };
		const cookie = "better-auth.session_token=session-a";

		await enforceRateLimit({
			worker: "data-service",
			request: listRequest({ cookie, "cf-connecting-ip": "203.0.113.1" }),
			env,
		});
		await enforceRateLimit({
			worker: "data-service",
			request: listRequest({ cookie, "cf-connecting-ip": "198.51.100.9" }),
			env,
		});

		expect(new Set(spent).size).toBe(1);
	});

	it("keeps two anonymous addresses on separate budgets", async () => {
		const { binding, spent } = fakeLimiter(10);
		const env = { RATE_LIMITER_READS: binding };

		await enforceRateLimit({
			worker: "data-service",
			request: listRequest({ "cf-connecting-ip": "203.0.113.1" }),
			env,
		});
		await enforceRateLimit({
			worker: "data-service",
			request: listRequest({ "cf-connecting-ip": "203.0.113.2" }),
			env,
		});

		expect(new Set(spent).size).toBe(2);
	});

	it("refuses to run unmetered when the rule's binding is missing", async () => {
		await expect(
			enforceRateLimit({
				worker: "data-service",
				request: listRequest({ "cf-connecting-ip": "203.0.113.1" }),
				env: {},
			}),
		).rejects.toBeInstanceOf(RateLimitConfigError);
	});
});
