import { enforceRateLimit, rateLimitHeaders, type WorkerName } from "@repo/data-ops/rate-limit";
import type { MiddlewareHandler } from "hono";

/**
 * Thin adapter over the shared rate-limit policy.
 *
 * It takes no threshold, no window, and no binding — only which Worker it is
 * running in. Everything else (which routes are metered, at what rate, keyed by
 * what, and what a throttled caller is told) is stated once in
 * `@repo/data-ops/rate-limit` and nowhere else.
 */
export const rateLimiter = (worker: WorkerName): MiddlewareHandler<{ Bindings: Env }> => {
	return async (c, next) => {
		const outcome = await enforceRateLimit({
			worker,
			request: c.req.raw,
			env: c.env as unknown as Record<string, unknown>,
		});

		if (!outcome.metered) return next();

		if (!outcome.allowed) return outcome.response;

		for (const [name, value] of Object.entries(rateLimitHeaders(outcome.rule))) {
			c.header(name, value);
		}
		return next();
	};
};
