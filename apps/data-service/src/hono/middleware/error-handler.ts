import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError, createErrorResponse, isError } from "../utils/error-handling";

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

export async function onErrorHandler(err: unknown, c: Context) {
	const requestId = c.get("requestId") || "unknown";

	if (err instanceof HTTPException) {
		const msg = await getHttpExceptionMessage(err);
		c.header("x-request-id", requestId);
		return c.json({ error: msg, requestId }, toContentfulStatusCode(err.status));
	}

	c.header("x-request-id", requestId);

	if (err instanceof ApiError) {
		return c.json(createErrorResponse(err), toContentfulStatusCode(err.statusCode));
	}

	if (isError(err)) {
		return c.json(createErrorResponse(err), 500);
	}

	return c.json({ error: "Internal server error" }, 500);
}
