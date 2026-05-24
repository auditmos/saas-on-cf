import type { MiddlewareHandler } from "hono";

export type GetSession = (req: Request) => Promise<unknown | null>;

export interface SessionAuthOptions {
	bearer: string;
	getSession: GetSession;
}

const BEARER_PREFIX = "Bearer ";

export const sessionAuth = (opts: SessionAuthOptions): MiddlewareHandler<{ Bindings: Env }> => {
	return async (c, next) => {
		const header = c.req.header("Authorization");
		if (header?.startsWith(BEARER_PREFIX) && header.slice(BEARER_PREFIX.length) === opts.bearer) {
			return next();
		}
		let session: unknown = null;
		try {
			session = await opts.getSession(c.req.raw);
		} catch {
			session = null;
		}
		if (session) {
			return next();
		}
		return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
	};
};
