import type { Context, Next } from "hono";
import { cors } from "hono/cors";

const getAllowedOrigins = (env: Env): string[] => {
	if (env.CLOUDFLARE_ENV === "dev") {
		return ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];
	}

	if (env.ALLOWED_ORIGINS) {
		return env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
	}

	return [];
};

export const createCorsMiddleware = () => {
	return async (c: Context<{ Bindings: Env }>, next: Next) => {
		const allowedOrigins = getAllowedOrigins(c.env);

		const corsMiddleware = cors({
			origin: (origin) => {
				return allowedOrigins.includes(origin) ? origin : undefined;
			},
			allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
			exposeHeaders: ["X-Total-Count", "X-Request-Id"],
			credentials: true,
			maxAge: 86400,
		});

		return corsMiddleware(c, next);
	};
};
