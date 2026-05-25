import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requestId } from "./request-id";

function buildApp() {
	const app = new Hono<{ Bindings: Env }>();
	app.use("*", requestId());
	app.get("/r", (c) => c.text(c.var.requestId));
	return (headers: Record<string, string> = {}) =>
		app.fetch(new Request("http://localhost/r", { headers }), {} as Env);
}

describe("requestId middleware", () => {
	it("rejects x-request-id containing characters outside [a-zA-Z0-9-] and regenerates an id", async () => {
		const fetch = buildApp();
		const injected = "<script>alert(1)</script>";
		const res = await fetch({ "x-request-id": injected });
		const echoed = res.headers.get("x-request-id");
		const body = await res.text();

		expect(echoed).not.toBe(injected);
		expect(body).not.toBe(injected);
		expect(echoed).toMatch(/^[a-zA-Z0-9-]{1,64}$/);
	});

	it("preserves a valid client-supplied UUID for log correlation", async () => {
		const fetch = buildApp();
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";
		const res = await fetch({ "x-request-id": validUuid });

		expect(res.headers.get("x-request-id")).toBe(validUuid);
		expect(await res.text()).toBe(validUuid);
	});

	it("generates a UUID when neither x-request-id nor cf-ray is present", async () => {
		const fetch = buildApp();
		const res = await fetch();
		const echoed = res.headers.get("x-request-id");
		const body = await res.text();

		expect(echoed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(body).toBe(echoed);
	});

	it("falls back to cf-ray when x-request-id is absent", async () => {
		const fetch = buildApp();
		const cfRay = "8a1f2b3c4d5e6f70-IAD";
		const res = await fetch({ "cf-ray": cfRay });

		expect(res.headers.get("x-request-id")).toBe(cfRay);
		expect(await res.text()).toBe(cfRay);
	});

	it("rejects x-request-id longer than 64 characters", async () => {
		const fetch = buildApp();
		const huge = "a".repeat(500);
		const res = await fetch({ "x-request-id": huge });
		const echoed = res.headers.get("x-request-id");

		expect(echoed).not.toBe(huge);
		expect(echoed?.length).toBeLessThanOrEqual(64);
		expect(echoed).toMatch(/^[a-zA-Z0-9-]{1,64}$/);
	});
});
