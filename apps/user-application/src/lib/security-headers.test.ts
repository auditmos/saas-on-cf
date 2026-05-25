import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "./security-headers";

describe("applySecurityHeaders", () => {
	it("adds X-Content-Type-Options: nosniff", () => {
		const res = applySecurityHeaders(new Response("ok"));
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("adds HSTS with 1-year max-age and includeSubDomains", () => {
		const res = applySecurityHeaders(new Response("ok"));
		expect(res.headers.get("Strict-Transport-Security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
	});

	it("adds Referrer-Policy: strict-origin-when-cross-origin", () => {
		const res = applySecurityHeaders(new Response("ok"));
		expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
	});

	it("adds X-Frame-Options: DENY", () => {
		const res = applySecurityHeaders(new Response("ok"));
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
	});

	it("disables camera, microphone, geolocation via Permissions-Policy", () => {
		const res = applySecurityHeaders(new Response("ok"));
		const policy = res.headers.get("Permissions-Policy");
		expect(policy).toContain("camera=()");
		expect(policy).toContain("microphone=()");
		expect(policy).toContain("geolocation=()");
	});

	it("sets a CSP that allows TanStack Start hydration (inline scripts) and forbids framing", () => {
		const res = applySecurityHeaders(new Response("<html></html>"));
		const csp = res.headers.get("Content-Security-Policy");
		expect(csp).toContain("default-src 'self'");
		expect(csp).toMatch(/script-src [^;]*'unsafe-inline'/);
		expect(csp).toMatch(/style-src [^;]*'unsafe-inline'/);
		expect(csp).toContain("frame-ancestors 'none'");
	});

	it("preserves original status, body, and existing response headers", async () => {
		const original = new Response("<html>hi</html>", {
			status: 201,
			headers: { "Content-Type": "text/html; charset=utf-8", "X-Custom": "kept" },
		});
		const res = applySecurityHeaders(original);

		expect(res.status).toBe(201);
		expect(await res.text()).toBe("<html>hi</html>");
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(res.headers.get("X-Custom")).toBe("kept");
	});
});
