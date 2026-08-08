import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError, createErrorResponse, isError } from "../utils/error-handling";

/**
 * Env values that must never reach the log. The handler never reads a request's
 * credentials, but an upstream driver can echo the one it was handed back inside
 * an error message, and that message is passed through verbatim.
 */
const SECRET_ENV_KEYS = [
	"DATABASE_PASSWORD",
	"DATABASE_USERNAME",
	"API_TOKEN",
	"BETTER_AUTH_SECRET",
] as const;

/** Short values would match too much unrelated text to be worth substituting. */
const MIN_REDACTABLE_LENGTH = 8;

interface LoggedFailure {
	message: "unhandled_error";
	requestId: string;
	method: string;
	route: string;
	error: { name: string; message: string; stack?: string };
}

function toContentfulStatusCode(code: number): ContentfulStatusCode {
	if (code >= 400 && code <= 599) return code as ContentfulStatusCode;
	return 500;
}

function getHttpStatusMessage(status: number): string {
	const messages: Record<number, string> = {
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		409: "Conflict",
		429: "Too Many Requests",
		500: "Internal Server Error",
	};
	return messages[status] || "Error";
}

async function getHttpExceptionMessage(e: HTTPException): Promise<string> {
	if (e.message) return e.message;
	try {
		const res = e.getResponse();
		return (await res.text()) || getHttpStatusMessage(e.status);
	} catch {
		return getHttpStatusMessage(e.status);
	}
}

function secretValues(env: unknown): string[] {
	if (typeof env !== "object" || env === null) return [];
	const record = env as Record<string, unknown>;
	const found: string[] = [];
	for (const key of SECRET_ENV_KEYS) {
		const value = record[key];
		if (typeof value === "string" && value.length >= MIN_REDACTABLE_LENGTH) found.push(value);
	}
	return found;
}

function redact(text: string, secrets: string[]): string {
	let out = text;
	for (const secret of secrets) out = out.replaceAll(secret, "[redacted]");
	return out;
}

function describeError(err: unknown, secrets: string[]): LoggedFailure["error"] {
	if (isError(err)) {
		return {
			name: err.name,
			message: redact(err.message, secrets),
			...(err.stack ? { stack: redact(err.stack, secrets) } : {}),
		};
	}
	return { name: typeof err, message: redact(String(err), secrets) };
}

/**
 * A 5xx is the only thing worth waking someone for: every 4xx here is a
 * deliberate answer the API chose to give. The record carries the correlation
 * id, the matched route and the stack — never the URL, headers, cookies or body,
 * so nothing the caller sent can be read back out of the log.
 */
function logUnexpectedFailure(c: Context, err: unknown, status: number, requestId: string): void {
	if (status < 500) return;

	const payload: LoggedFailure = {
		message: "unhandled_error",
		requestId,
		method: c.req.method,
		route: c.req.routePath,
		error: describeError(err, secretValues(c.env)),
	};

	// A single object argument is what Workers observability indexes as fields.
	// biome-ignore lint/suspicious/noConsole: this function is the log pipeline
	console.error(payload);
}

export async function onErrorHandler(err: unknown, c: Context) {
	const requestId = c.get("requestId") || "unknown";

	if (err instanceof HTTPException) {
		const msg = await getHttpExceptionMessage(err);
		logUnexpectedFailure(c, err, err.status, requestId);
		c.header("x-request-id", requestId);
		return c.json({ error: msg, requestId }, toContentfulStatusCode(err.status));
	}

	c.header("x-request-id", requestId);

	if (err instanceof ApiError) {
		logUnexpectedFailure(c, err, err.statusCode, requestId);
		return c.json(createErrorResponse(err), toContentfulStatusCode(err.statusCode));
	}

	logUnexpectedFailure(c, err, 500, requestId);

	if (isError(err)) {
		return c.json(createErrorResponse(err), 500);
	}

	return c.json({ error: "Internal server error" }, 500);
}
