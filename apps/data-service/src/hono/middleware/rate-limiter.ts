import type { MiddlewareHandler } from "hono";

interface RateLimitConfig {
	windowMs: number;
	maxRequests: number;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();
let requestCounter = 0;
const CLEANUP_INTERVAL = 100;

function cleanupExpired(now: number) {
	for (const [ip, record] of requestCounts) {
		if (now > record.resetTime) requestCounts.delete(ip);
	}
}

export const rateLimiter = (config: RateLimitConfig): MiddlewareHandler => {
	return async (c, next) => {
		const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
		const now = Date.now();

		if (++requestCounter % CLEANUP_INTERVAL === 0) cleanupExpired(now);

		const record = requestCounts.get(ip);

		if (!record || now > record.resetTime) {
			requestCounts.set(ip, { count: 1, resetTime: now + config.windowMs });
			return next();
		}

		if (record.count >= config.maxRequests) {
			return c.json({ error: "Too many requests" }, 429);
		}

		record.count++;
		return next();
	};
};
