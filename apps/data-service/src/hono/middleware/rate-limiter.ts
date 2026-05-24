import type { MiddlewareHandler } from "hono";

type BindingResolver =
	| RateLimit
	| { [K in keyof Env]: Env[K] extends RateLimit ? K : never }[keyof Env];

interface RateLimitConfig {
	binding: BindingResolver;
	limit: number;
	window: number;
}

function resolve(binding: BindingResolver, env: Env): RateLimit {
	return typeof binding === "string" ? (env[binding] as RateLimit) : binding;
}

export const rateLimiter = (config: RateLimitConfig): MiddlewareHandler => {
	return async (c, next) => {
		const key = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "anonymous";

		const binding = resolve(config.binding, c.env as Env);
		const { success } = await binding.limit({ key });

		c.header("X-RateLimit-Limit", String(config.limit));
		c.header("X-RateLimit-Reset", String(config.window));

		if (!success) {
			c.header("Retry-After", String(config.window));
			c.header("X-RateLimit-Remaining", "0");
			return c.json({ error: "Too many requests" }, 429);
		}

		return next();
	};
};
