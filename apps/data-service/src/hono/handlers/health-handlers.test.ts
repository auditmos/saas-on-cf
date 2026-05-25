import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import health from "./health-handlers";

function readyReq(ip: string) {
	return new Request("http://localhost/ready", {
		headers: { "cf-connecting-ip": ip },
	});
}

function randIp() {
	const o = () => Math.floor(Math.random() * 250) + 1;
	return `10.${o()}.${o()}.${o()}`;
}

describe("GET /health/ready", () => {
	it("never returns 429, even when hammered well past any rate-limit budget", async () => {
		const ip = randIp();

		for (let i = 0; i < 30; i++) {
			const res = await health.fetch(readyReq(ip), env);
			expect(res.status, `request #${i + 1} returned ${res.status}`).not.toBe(429);
		}
	});
});
