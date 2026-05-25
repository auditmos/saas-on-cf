import { Hono } from "hono";
import * as honoCors from "hono/cors";
import { describe, expect, it, vi } from "vitest";
import { createCorsMiddleware } from "./cors";

vi.mock("hono/cors", async (importOriginal) => {
	const actual = await importOriginal<typeof import("hono/cors")>();
	return { cors: vi.fn(actual.cors) };
});

function buildApp(env: Partial<Env>) {
	const app = new Hono<{ Bindings: Env }>();
	app.use("*", createCorsMiddleware());
	app.get("/r", (c) => c.text("ok"));
	return (origin: string) =>
		app.fetch(new Request("http://localhost/r", { headers: { Origin: origin } }), env as Env);
}

describe("createCorsMiddleware", () => {
	it("echoes http://localhost:3000 as an allowed origin in dev", async () => {
		const fetch = buildApp({ CLOUDFLARE_ENV: "dev" });
		const res = await fetch("http://localhost:3000");
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
	});

	it("does NOT allow http://localhost:5173 in dev (stale Vite port)", async () => {
		const fetch = buildApp({ CLOUDFLARE_ENV: "dev" });
		const res = await fetch("http://localhost:5173");
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("in non-dev, echoes an origin listed in ALLOWED_ORIGINS", async () => {
		const fetch = buildApp({
			CLOUDFLARE_ENV: "staging",
			ALLOWED_ORIGINS: "https://staging.example.com,https://app.example.com",
		});
		const res = await fetch("https://app.example.com");
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
	});

	it("in non-dev, omits Allow-Origin for origins not in ALLOWED_ORIGINS", async () => {
		const fetch = buildApp({
			CLOUDFLARE_ENV: "staging",
			ALLOWED_ORIGINS: "https://staging.example.com",
		});
		const res = await fetch("https://evil.example.com");
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("builds the underlying cors() factory at most once across many requests", async () => {
		const spy = vi.mocked(honoCors.cors);
		spy.mockClear();

		const fetch = buildApp({ CLOUDFLARE_ENV: "dev" });
		for (let i = 0; i < 100; i++) {
			await fetch("http://localhost:3000");
		}

		expect(spy).toHaveBeenCalledTimes(1);
	});
});
