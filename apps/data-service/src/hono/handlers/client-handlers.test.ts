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

describe("client mutation routes enforce a rate-limit budget", () => {
	it("returns 429 on POST /clients past the budget (rate-limit runs before auth)", async () => {
		const ip = randIp();

		const postWithIp = () =>
			clients.fetch(
				new Request(
					"http://localhost/",
					withWrongBearer({
						method: "POST",
						headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
						body: jsonBody,
					}),
				),
				env,
			);

		for (let i = 0; i < 10; i++) {
			const res = await postWithIp();
			expect(res.status, `request #${i + 1} should hit auth and 401`).toBe(401);
		}

		const eleventh = await postWithIp();
		expect(eleventh.status).toBe(429);
	});
});
