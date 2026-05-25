import { describe, expect, it } from "vitest";
import { App } from "../app";

function fetchApp(path: string, env: Partial<Env> = { CLOUDFLARE_ENV: "dev" }) {
	return App.fetch(new Request(`http://localhost${path}`), env as Env);
}

describe("security headers (data-service)", () => {
	it("sets X-Content-Type-Options: nosniff on responses", async () => {
		const res = await fetchApp("/health/live");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("sets HSTS with 1-year max-age and includeSubDomains", async () => {
		const res = await fetchApp("/health/live");
		expect(res.headers.get("Strict-Transport-Security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
	});

	it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
		const res = await fetchApp("/health/live");
		expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
	});

	it("sets X-Frame-Options: DENY", async () => {
		const res = await fetchApp("/health/live");
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
	});

	it("sets a strict CSP suitable for a JSON API", async () => {
		const res = await fetchApp("/health/live");
		const csp = res.headers.get("Content-Security-Policy");
		expect(csp).toContain("default-src 'none'");
		expect(csp).toContain("frame-ancestors 'none'");
	});

	it("disables camera, microphone, geolocation via Permissions-Policy", async () => {
		const res = await fetchApp("/health/live");
		const policy = res.headers.get("Permissions-Policy");
		expect(policy).toContain("camera=()");
		expect(policy).toContain("microphone=()");
		expect(policy).toContain("geolocation=()");
	});

	it("applies headers to unmatched routes (404)", async () => {
		const res = await fetchApp("/route-that-does-not-exist");
		expect(res.status).toBe(404);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
	});
});
