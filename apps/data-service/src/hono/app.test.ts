import { env } from "cloudflare:test";
import { RATE_LIMIT_POLICY } from "@repo/data-ops/rate-limit";
import { describe, expect, it } from "vitest";
import { App } from "./app";

const rule = (id: string) => {
	const found = RATE_LIMIT_POLICY.find((r) => r.id === id);
	if (!found) throw new Error(`the policy no longer declares ${id}`);
	return found;
};

const READ = rule("ds:clients:read");
const WRITE = rule("ds:clients:write");

function randIp() {
	const o = () => Math.floor(Math.random() * 250) + 1;
	return `10.${o()}.${o()}.${o()}`;
}

const jsonBody = JSON.stringify({ name: "x", surname: "y", email: "a@b.com" });

/** Wrong on purpose: metering must happen before the session check, not after it. */
const WRONG_BEARER = "Bearer wrong-token-not-the-real-one";

describe("the API meters reads", () => {
	it("throttles the client list endpoint past the policy's threshold", async () => {
		const ip = randIp();
		const get = () =>
			App.fetch(
				new Request("http://localhost/clients?limit=10&offset=0", {
					headers: { "cf-connecting-ip": ip, Authorization: WRONG_BEARER },
				}),
				env,
			);

		for (let i = 0; i < READ.limit; i++) {
			expect((await get()).status, `read #${i + 1} should reach auth and 401`).toBe(401);
		}

		expect((await get()).status).toBe(429);
	});

	it("throttles the client detail endpoint on the same budget as the list", async () => {
		const ip = randIp();
		const fetchPath = (path: string) =>
			App.fetch(
				new Request(`http://localhost${path}`, {
					headers: { "cf-connecting-ip": ip, Authorization: WRONG_BEARER },
				}),
				env,
			);

		for (let i = 0; i < READ.limit; i++) {
			expect((await fetchPath("/clients")).status).toBe(401);
		}

		expect((await fetchPath("/clients/abc")).status).toBe(429);
	});
});

describe("the API still meters mutations after the migration off the legacy binding", () => {
	it("throttles POST /clients past the policy's threshold", async () => {
		const ip = randIp();
		const post = () =>
			App.fetch(
				new Request("http://localhost/clients", {
					method: "POST",
					headers: {
						"cf-connecting-ip": ip,
						Authorization: WRONG_BEARER,
						"Content-Type": "application/json",
					},
					body: jsonBody,
				}),
				env,
			);

		for (let i = 0; i < WRITE.limit; i++) {
			expect((await post()).status, `write #${i + 1} should reach auth and 401`).toBe(401);
		}

		expect((await post()).status).toBe(429);
	});

	it("keeps the write budget separate from the read budget", async () => {
		const ip = randIp();
		const post = () =>
			App.fetch(
				new Request("http://localhost/clients", {
					method: "POST",
					headers: {
						"cf-connecting-ip": ip,
						Authorization: WRONG_BEARER,
						"Content-Type": "application/json",
					},
					body: jsonBody,
				}),
				env,
			);

		for (let i = 0; i < WRITE.limit; i++) await post();
		expect((await post()).status, "writes are spent").toBe(429);

		const read = await App.fetch(
			new Request("http://localhost/clients?limit=10&offset=0", {
				headers: { "cf-connecting-ip": ip, Authorization: WRONG_BEARER },
			}),
			env,
		);
		expect(read.status, "reads have their own budget").toBe(401);
	});
});

describe("the API keys limits by caller identity", () => {
	const spendReads = (headers: Record<string, string>) =>
		App.fetch(
			new Request("http://localhost/clients?limit=10&offset=0", {
				headers: { ...headers, Authorization: WRONG_BEARER },
			}),
			env,
		);

	it("gives two sessions independent budgets", async () => {
		const sessionA = { cookie: "better-auth.session_token=app-test-session-a" };
		const sessionB = { cookie: "better-auth.session_token=app-test-session-b" };

		for (let i = 0; i < READ.limit; i++) await spendReads(sessionA);
		expect((await spendReads(sessionA)).status).toBe(429);

		expect((await spendReads(sessionB)).status).toBe(401);
	});

	it("does not let a session reset its budget by moving address", async () => {
		const cookie = "better-auth.session_token=app-test-session-roaming";

		for (let i = 0; i < READ.limit; i++) {
			await spendReads({ cookie, "cf-connecting-ip": "203.0.113.10" });
		}

		const fromElsewhere = await spendReads({ cookie, "cf-connecting-ip": "198.51.100.77" });
		expect(fromElsewhere.status).toBe(429);
	});

	it("does not let an address reset its budget by discarding cookies", async () => {
		const ip = randIp();

		for (let i = 0; i < READ.limit; i++) await spendReads({ "cf-connecting-ip": ip });
		expect((await spendReads({ "cf-connecting-ip": ip })).status).toBe(429);

		const cookieless = await spendReads({ "cf-connecting-ip": ip, cookie: "theme=dark" });
		expect(cookieless.status).toBe(429);
	});

	it("gives two anonymous addresses independent budgets", async () => {
		const spent = randIp();

		for (let i = 0; i < READ.limit; i++) await spendReads({ "cf-connecting-ip": spent });
		expect((await spendReads({ "cf-connecting-ip": spent })).status).toBe(429);

		expect((await spendReads({ "cf-connecting-ip": randIp() })).status).toBe(401);
	});
});
