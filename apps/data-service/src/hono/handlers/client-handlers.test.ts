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
