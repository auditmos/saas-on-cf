import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import clients from "./client-handlers";

const jsonBody = JSON.stringify({ name: "x", surname: "y", email: "a@b.com" });

function withWrongBearer(init: RequestInit = {}): RequestInit {
	return {
		...init,
		headers: { ...init.headers, Authorization: "Bearer wrong-token-not-the-real-one" },
	};
}

function randIp() {
	const o = () => Math.floor(Math.random() * 250) + 1;
	return `10.${o()}.${o()}.${o()}`;
}

describe("client mutation routes require auth", () => {
	it("rejects POST /clients when bearer is wrong (and no cookie)", async () => {
		const res = await clients.fetch(
			new Request(
				"http://localhost/",
				withWrongBearer({
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: jsonBody,
				}),
			),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("rejects PUT /clients/:id when bearer is wrong (and no cookie)", async () => {
		const res = await clients.fetch(
			new Request(
				"http://localhost/abc",
				withWrongBearer({
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "x" }),
				}),
			),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("rejects DELETE /clients/:id when bearer is wrong (and no cookie)", async () => {
		const res = await clients.fetch(
			new Request("http://localhost/abc", withWrongBearer({ method: "DELETE" })),
			env,
		);
		expect(res.status).toBe(401);
	});
});

describe("client read routes require auth", () => {
	it("rejects GET /clients when there is no session and no bearer", async () => {
		const res = await clients.fetch(new Request("http://localhost/?limit=10&offset=0"), env);
		expect(res.status).toBe(401);
	});

	it("rejects GET /clients/:id when there is no session and no bearer", async () => {
		const res = await clients.fetch(new Request("http://localhost/abc"), env);
		expect(res.status).toBe(401);
	});

	it("rejects GET /clients when the bearer is wrong", async () => {
		const res = await clients.fetch(
			new Request("http://localhost/?limit=10&offset=0", withWrongBearer()),
			env,
		);
		expect(res.status).toBe(401);
	});

	it("lets the service-to-service bearer through to the handler", async () => {
		// The frontend's binding path attaches API_TOKEN. Past the gate the handler
		// reaches for a database this test has not initialised, so the assertion is
		// "not turned away at the gate" rather than a specific success status.
		const res = await clients.fetch(
			new Request("http://localhost/?limit=10&offset=0", {
				headers: { Authorization: "Bearer s2s-token" },
			}),
			{ ...env, API_TOKEN: "s2s-token" },
		);
		expect(res.status).not.toBe(401);
	});
});

describe("no client-facing route is anonymously reachable", () => {
	// Wildcard entries are the router-level middleware registrations, not endpoints.
	const declaredRoutes = [
		...new Map(
			clients.routes
				.filter((r) => !r.path.includes("*") && r.method !== "ALL")
				.map((r) => [`${r.method} ${r.path}`, r]),
		).values(),
	];

	it("declares the five CRUD routes it is expected to guard", () => {
		expect(declaredRoutes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
			"DELETE /:id",
			"GET /",
			"GET /:id",
			"POST /",
			"PUT /:id",
		]);
	});

	it.each(
		declaredRoutes.map((r) => [r.method, r.path] as const),
	)("returns 401 for anonymous %s %s", async (method, path) => {
		const hasBody = method === "POST" || method === "PUT";
		const res = await clients.fetch(
			new Request(`http://localhost${path.replace(":id", "abc")}`, {
				method,
				headers: { "Content-Type": "application/json", "cf-connecting-ip": randIp() },
				...(hasBody ? { body: jsonBody } : {}),
			}),
			env,
		);
		expect(res.status).toBe(401);
	});
});

// Rate limiting moved to the app boundary when the policy module took ownership
// of every threshold. Its tests live in `../app.test.ts`, which is where the
// limiter is now registered — this router no longer meters anything itself.
