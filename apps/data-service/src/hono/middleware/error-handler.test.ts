/**
 * A production failure has to be findable after the fact. These tests run in the
 * Workers runtime and force real failures through the global error handler, then
 * assert on what reaches the log pipeline: one structured record per unexpected
 * failure, carrying enough to attribute it to a request and a code path, and
 * carrying none of the caller's credentials.
 */

import { env } from "cloudflare:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../utils/error-handling";
import { onErrorHandler } from "./error-handler";
import { requestId } from "./request-id";

let logged: unknown[][] = [];

beforeEach(() => {
	logged = [];
	vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		logged.push(args);
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** A Worker whose only route fails the way the thing being tested fails. */
function workerThatThrows(err: unknown) {
	const app = new Hono<{ Bindings: Env }>();
	app.use("*", requestId());
	app.onError(onErrorHandler);
	app.get("/clients/:id", () => {
		throw err;
	});
	return app;
}

interface LoggedFailure {
	message: string;
	requestId: string;
	method: string;
	route: string;
	error: { name: string; message: string; stack?: string };
}

/** The single record the handler is expected to have emitted. */
function onlyRecord(): LoggedFailure {
	expect(logged, "exactly one log record per unexpected failure").toHaveLength(1);
	const args = logged[0] ?? [];
	expect(args, "the record is one structured argument, not a formatted string").toHaveLength(1);
	const [payload] = args;
	expect(typeof payload, "a bare string is not queryable — log an object").toBe("object");
	return payload as LoggedFailure;
}

describe("an unexpected failure is written to the log as structured context", () => {
	it("emits one structured record when a route throws", async () => {
		const app = workerThatThrows(new Error("the database went away"));

		const res = await app.fetch(
			new Request("http://localhost/clients/c-1", { headers: { "x-request-id": "req-42" } }),
			env,
		);

		expect(res.status).toBe(500);
		const record = onlyRecord();
		expect(record.message).toBe("unhandled_error");
	});

	it("carries enough to attribute the failure to a request", async () => {
		const app = workerThatThrows(new Error("the database went away"));

		await app.fetch(
			new Request("http://localhost/clients/c-1", { headers: { "x-request-id": "req-42" } }),
			env,
		);

		const record = onlyRecord();
		expect(record.requestId, "joins the record to the request's other telemetry").toBe("req-42");
		expect(record.method).toBe("GET");
	});

	it("carries enough to attribute the failure to a code path", async () => {
		const app = workerThatThrows(new Error("the database went away"));

		await app.fetch(new Request("http://localhost/clients/c-1"), env);

		const record = onlyRecord();
		expect(record.route, "the matched route, not the requested URL").toBe("/clients/:id");
		expect(record.error.name).toBe("Error");
		expect(record.error.message).toBe("the database went away");
		expect(typeof record.error.stack, "the stack is the code path").toBe("string");
	});

	it("records the failure even when no correlation id was assigned", async () => {
		const app = new Hono<{ Bindings: Env }>();
		app.onError(onErrorHandler);
		app.get("/clients/:id", () => {
			throw new Error("boom");
		});

		const res = await app.fetch(new Request("http://localhost/clients/c-1"), env);

		expect(res.status).toBe(500);
		expect(onlyRecord().requestId, "an unattributable failure still gets written").toBe("unknown");
	});
});

describe("expected, handled responses are not logged as unexpected failures", () => {
	it("does not log an HTTPException the app raised deliberately", async () => {
		const app = workerThatThrows(new HTTPException(401, { message: "Unauthorized" }));

		const res = await app.fetch(new Request("http://localhost/clients/c-1"), env);

		expect(res.status).toBe(401);
		expect(logged, "a 401 is an answer, not a failure").toHaveLength(0);
	});

	it("does not log an ApiError that resolves to a client error", async () => {
		const app = workerThatThrows(new ApiError("no such client", 404, "NOT_FOUND"));

		const res = await app.fetch(new Request("http://localhost/clients/c-1"), env);

		expect(res.status).toBe(404);
		expect(logged).toHaveLength(0);
	});

	it("does not log a successful response", async () => {
		const app = new Hono<{ Bindings: Env }>();
		app.use("*", requestId());
		app.onError(onErrorHandler);
		app.get("/clients/:id", (c) => c.json({ id: c.req.param("id") }));

		const res = await app.fetch(new Request("http://localhost/clients/c-1"), env);

		expect(res.status).toBe(200);
		expect(logged).toHaveLength(0);
	});

	it("still logs an ApiError that resolves to a server error", async () => {
		const app = workerThatThrows(new ApiError("upstream exploded", 500, "UPSTREAM"));

		const res = await app.fetch(new Request("http://localhost/clients/c-1"), env);

		expect(res.status).toBe(500);
		const record = onlyRecord();
		expect(record.error.message).toBe("upstream exploded");
	});

	it("still logs an HTTPException that resolves to a server error", async () => {
		const app = workerThatThrows(new HTTPException(503, { message: "no capacity" }));

		const res = await app.fetch(new Request("http://localhost/clients/c-1"), env);

		expect(res.status).toBe(503);
		expect(onlyRecord().message).toBe("unhandled_error");
	});
});

describe("the log record carries no credentials and no caller data", () => {
	const SESSION = "better-auth.session_token=a-real-looking-session-value";
	const BEARER = "Bearer the-callers-api-token";

	async function failWithACredentialedRequest() {
		const app = workerThatThrows(new Error("boom"));
		await app.fetch(
			new Request("http://localhost/clients/c-1?email=person%40example.com&q=secret-query", {
				headers: {
					Authorization: BEARER,
					cookie: SESSION,
					"cf-connecting-ip": "203.0.113.9",
				},
			}),
			env,
		);
		return JSON.stringify(onlyRecord());
	}

	it("does not carry the Authorization header", async () => {
		expect(await failWithACredentialedRequest()).not.toContain("the-callers-api-token");
	});

	it("does not carry cookies", async () => {
		expect(await failWithACredentialedRequest()).not.toContain("a-real-looking-session-value");
	});

	it("does not carry the query string", async () => {
		const serialised = await failWithACredentialedRequest();
		expect(serialised).not.toContain("person@example.com");
		expect(serialised).not.toContain("secret-query");
	});

	it("does not carry the caller's address", async () => {
		expect(await failWithACredentialedRequest()).not.toContain("203.0.113.9");
	});

	it("redacts a secret that leaked into the error message itself", async () => {
		const secret = "pscale_pw_do_not_log_this";
		const app = workerThatThrows(new Error(`connect ECONNREFUSED with password ${secret}`));

		await app.fetch(new Request("http://localhost/clients/c-1"), {
			...env,
			DATABASE_PASSWORD: secret,
		} as Env);

		const serialised = JSON.stringify(onlyRecord());
		expect(serialised, "an upstream driver can echo the credential it was given").not.toContain(
			secret,
		);
		expect(serialised).toContain("[redacted]");
	});
});
