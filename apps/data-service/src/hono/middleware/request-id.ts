import type { MiddlewareHandler } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		requestId: string;
	}
}

const REQUEST_ID_RE = /^[a-zA-Z0-9-]{1,64}$/;

export const requestId = (): MiddlewareHandler => {
	return async (c, next) => {
		const clientId = c.req.header("x-request-id");
		const id =
			clientId && REQUEST_ID_RE.test(clientId)
				? clientId
				: (c.req.header("cf-ray") ?? crypto.randomUUID());

		c.set("requestId", id);

		await next();

		c.header("x-request-id", id);
	};
};
