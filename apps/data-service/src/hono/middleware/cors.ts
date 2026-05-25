import type { Context, Next } from "hono";
import { cors } from "hono/cors";

const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const CORS_OPTIONS = {
	allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	exposeHeaders: ["X-Total-Count", "X-Request-Id"],
	credentials: true,
	maxAge: 86400,
};

const parseAllowed = (raw: string | undefined): string[] =>
	raw ? raw.split(",").map((o) => o.trim()) : [];

const buildOriginMatcher = (allowed: string[]) => (origin: string) =>
	allowed.includes(origin) ? origin : undefined;

type CorsMiddleware = ReturnType<typeof cors>;

export const createCorsMiddleware = () => {
	let devCors: CorsMiddleware | null = null;
	let nonDevCors: CorsMiddleware | null = null;
	let cachedAllowed: string | undefined;

	return async (c: Context<{ Bindings: Env }>, next: Next) => {
		if (c.env.CLOUDFLARE_ENV === "dev") {
			devCors ??= cors({ origin: buildOriginMatcher(DEV_ORIGINS), ...CORS_OPTIONS });
			return devCors(c, next);
		}

		if (!nonDevCors || cachedAllowed !== c.env.ALLOWED_ORIGINS) {
			cachedAllowed = c.env.ALLOWED_ORIGINS;
			nonDevCors = cors({
				origin: buildOriginMatcher(parseAllowed(c.env.ALLOWED_ORIGINS)),
				...CORS_OPTIONS,
			});
		}
		return nonDevCors(c, next);
	};
};
