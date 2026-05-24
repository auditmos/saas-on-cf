import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type GetSession, sessionAuth } from "./session-auth";

const BEARER = "test-bearer-1234";

const noSession: GetSession = async () => null;

function buildApp(getSession: GetSession = noSession) {
	const app = new Hono<{ Bindings: Env }>();
	app.use("/protected", sessionAuth({ bearer: BEARER, getSession }));
	app.get("/protected", (c) => c.text("ok"));
	return app;
}

describe("sessionAuth middleware", () => {
	it("rejects requests with no Authorization header and no session", async () => {
		const app = buildApp();
		const res = await app.fetch(new Request("http://localhost/protected"));
		expect(res.status).toBe(401);
	});

	it("allows requests bearing the configured token", async () => {
		const app = buildApp();
		const res = await app.fetch(
			new Request("http://localhost/protected", {
				headers: { Authorization: `Bearer ${BEARER}` },
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	it("rejects requests bearing a wrong token", async () => {
		const app = buildApp();
		const res = await app.fetch(
			new Request("http://localhost/protected", {
				headers: { Authorization: "Bearer wrong-token" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("allows requests carrying a valid Better Auth session cookie", async () => {
		const sessionFromCookie: GetSession = async (req) =>
			req.headers.get("cookie")?.includes("better-auth.session_token=valid")
				? { user: { id: "u1", email: "a@b.com" } }
				: null;
		const app = buildApp(sessionFromCookie);
		const res = await app.fetch(
			new Request("http://localhost/protected", {
				headers: { cookie: "better-auth.session_token=valid" },
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	it("rejects requests when getSession returns null", async () => {
		const app = buildApp(noSession);
		const res = await app.fetch(
			new Request("http://localhost/protected", {
				headers: { cookie: "better-auth.session_token=expired" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects requests when getSession throws (auth subsystem error)", async () => {
		const throwingSession: GetSession = async () => {
			throw new Error("Auth not initialized");
		};
		const app = buildApp(throwingSession);
		const res = await app.fetch(new Request("http://localhost/protected"));
		expect(res.status).toBe(401);
	});
});
