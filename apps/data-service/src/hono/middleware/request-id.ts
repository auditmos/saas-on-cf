import type { MiddlewareHandler } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		requestId: string;
	}
}

export const requestId = (): MiddlewareHandler => {
	return async (c, next) => {
		const id = c.req.header("x-request-id") || c.req.header("cf-ray") || crypto.randomUUID();

		c.set("requestId", id);

		await next();

		c.header("x-request-id", id);
	};
};
