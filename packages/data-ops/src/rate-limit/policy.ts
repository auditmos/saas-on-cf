/**
 * The rate-limit policy — the single place any limit in this repository is
 * stated.
 *
 * Both Workers read their rules from `RATE_LIMIT_POLICY`. No call site names a
 * threshold; `scripts/rate-limit-policy.test.ts` fails the build if one starts
 * to. That guardrail is the point of the module: limits stated at call sites
 * drift apart silently, and nobody can answer "what is metered?" without
 * reading every route file.
 *
 * The declared `limit`/`period` mirror the platform bindings in each Worker's
 * `wrangler.jsonc` `ratelimits` block. The platform enforces the binding's
 * numbers; these exist so the policy is readable and so the guardrail test can
 * assert the two agree.
 */

/** The Workers this policy covers. */
export type WorkerName = "data-service" | "user-application";

/** The platform's `ratelimits[].simple.period` accepts only these two values. */
export type RateLimitPeriod = 10 | 60;

export interface RateLimitRule {
	/** Stable identifier. Namespaces the derived key and names the rule in tests. */
	readonly id: string;
	readonly worker: WorkerName;
	/** Binding name in that Worker's `Env`. Must exist in its `ratelimits` block. */
	readonly binding: string;
	readonly methods: readonly string[];
	/**
	 * Matches the path itself and anything beneath it — `/clients` covers
	 * `/clients/abc` but not `/clientsomething`.
	 */
	readonly pathPrefix: string;
	/** Requests allowed per `period`. Mirrors `ratelimits[].simple.limit`. */
	readonly limit: number;
	/** Seconds. Mirrors `ratelimits[].simple.period`. */
	readonly period: RateLimitPeriod;
	/** Why this limit exists, for whoever reads the policy next. */
	readonly reason: string;
}

const READ_METHODS = ["GET", "HEAD"] as const;
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * First match wins, so order matters: narrower rules go above broader ones.
 */
export const RATE_LIMIT_POLICY: readonly RateLimitRule[] = [
	{
		id: "ds:clients:write",
		worker: "data-service",
		binding: "RATE_LIMITER_MUTATIONS",
		methods: WRITE_METHODS,
		pathPrefix: "/clients",
		limit: 10,
		period: 60,
		reason:
			"Writes are expensive and rarely bursty from a legitimate caller. This is the limit that was in force before the policy module existed; it is restated here unchanged.",
	},
	{
		id: "ds:clients:read",
		worker: "data-service",
		binding: "RATE_LIMITER_READS",
		methods: READ_METHODS,
		pathPrefix: "/clients",
		limit: 60,
		period: 60,
		reason:
			"Reads return names and email addresses. Authentication stops anonymous enumeration; this caps how fast one authenticated caller can walk the list.",
	},
	{
		id: "ua:server-fn",
		worker: "user-application",
		binding: "RATE_LIMITER_SERVER_FN",
		methods: [...READ_METHODS, ...WRITE_METHODS],
		pathPrefix: "/_serverFn",
		limit: 100,
		period: 60,
		reason:
			"Server functions are public HTTP endpoints and the frontend's whole data surface. Generous enough that ordinary interaction never notices; low enough to cap scripted enumeration.",
	},
];

/** Returns the rule governing a request, or `undefined` if the path is unmetered. */
export function resolveRateLimitRule(
	worker: WorkerName,
	method: string,
	pathname: string,
): RateLimitRule | undefined {
	const upper = method.toUpperCase();
	return RATE_LIMIT_POLICY.find(
		(rule) =>
			rule.worker === worker &&
			rule.methods.includes(upper) &&
			(pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`)),
	);
}

export interface RateLimitCaller {
	/**
	 * Raw session cookie value, when the request carries one. Hashed before it
	 * reaches a limiter key — it is a credential, and a key is not a place to
	 * put one.
	 */
	readonly sessionToken?: string | null;
	/** Client address, from `cf-connecting-ip`. */
	readonly address?: string | null;
}

const SESSION_COOKIE_SUFFIX = "better-auth.session_token";

/**
 * Derives the caller identity from the request alone — no session lookup, so
 * the limiter can run ahead of authentication and an unauthenticated flood
 * costs nothing but a header read.
 */
export function callerFromRequest(request: Request): RateLimitCaller {
	const cookieHeader = request.headers.get("cookie") ?? "";
	let sessionToken: string | null = null;

	for (const part of cookieHeader.split(";")) {
		const separator = part.indexOf("=");
		if (separator === -1) continue;
		const name = part.slice(0, separator).trim();
		// Better Auth prefixes the cookie with `__Secure-` over HTTPS.
		if (name === SESSION_COOKIE_SUFFIX || name.endsWith(`-${SESSION_COOKIE_SUFFIX}`)) {
			sessionToken = part.slice(separator + 1).trim();
			break;
		}
	}

	return { sessionToken, address: request.headers.get("cf-connecting-ip") };
}

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Session identity where a session exists, client address otherwise.
 *
 * The two branches are what make the limit hard to shed. Keying a session on
 * its token alone means moving address does not reset the budget; keying an
 * anonymous caller on address alone means dropping cookies does not either.
 * A caller with neither lands in a shared bucket rather than escaping metering.
 */
export async function deriveRateLimitKey(
	rule: RateLimitRule,
	caller: RateLimitCaller,
): Promise<string> {
	if (caller.sessionToken) {
		return `${rule.id}:s:${(await sha256Hex(caller.sessionToken)).slice(0, 32)}`;
	}
	return `${rule.id}:a:${caller.address ?? "unattributed"}`;
}

/** A rule names a binding its Worker does not declare. Always a configuration bug. */
export class RateLimitConfigError extends Error {
	constructor(
		public readonly rule: RateLimitRule,
		message: string,
	) {
		super(message);
		this.name = "RateLimitConfigError";
	}
}

/** The single body shape both Workers return when a caller is throttled. */
export interface ThrottledBody {
	readonly error: string;
	readonly code: "RATE_LIMITED";
	readonly retryAfter: number;
}

/** Budget headers for responses that were allowed through. */
export function rateLimitHeaders(rule: RateLimitRule): Record<string, string> {
	return {
		"X-RateLimit-Limit": String(rule.limit),
		"X-RateLimit-Reset": String(rule.period),
	};
}

export function throttledResponse(rule: RateLimitRule): Response {
	const body: ThrottledBody = {
		error: "Too many requests",
		code: "RATE_LIMITED",
		retryAfter: rule.period,
	};

	return new Response(JSON.stringify(body), {
		status: 429,
		headers: {
			"Content-Type": "application/json",
			"Retry-After": String(rule.period),
			"X-RateLimit-Remaining": "0",
			...rateLimitHeaders(rule),
		},
	});
}

/** The slice of a Worker `Env` this module needs — a bag of possible bindings. */
export type RateLimitEnv = Record<string, unknown>;

interface PlatformLimiter {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

function isPlatformLimiter(value: unknown): value is PlatformLimiter {
	return typeof (value as PlatformLimiter | undefined)?.limit === "function";
}

export type RateLimitOutcome =
	| { readonly metered: false }
	| { readonly metered: true; readonly allowed: true; readonly rule: RateLimitRule }
	| {
			readonly metered: true;
			readonly allowed: false;
			readonly rule: RateLimitRule;
			readonly response: Response;
	  };

/**
 * Meters one request against the policy. The whole decision — which rule
 * applies, which key it is spent against, and what a throttled caller is told —
 * lives here, so a call site is left with nothing to state but which Worker it
 * is.
 *
 * Throws rather than passing the request through when a rule's binding is
 * absent: an unmetered route that is supposed to be metered is the failure this
 * module exists to prevent, and it should be loud.
 */
export async function enforceRateLimit(args: {
	worker: WorkerName;
	request: Request;
	env: RateLimitEnv;
}): Promise<RateLimitOutcome> {
	const { pathname } = new URL(args.request.url);
	const rule = resolveRateLimitRule(args.worker, args.request.method, pathname);
	if (!rule) return { metered: false };

	const binding = args.env[rule.binding];
	if (!isPlatformLimiter(binding)) {
		throw new RateLimitConfigError(
			rule,
			`Rule "${rule.id}" needs binding "${rule.binding}", which ${args.worker} does not declare. Add it to the ratelimits block in wrangler.jsonc.`,
		);
	}

	const key = await deriveRateLimitKey(rule, callerFromRequest(args.request));
	const { success } = await binding.limit({ key });

	return success
		? { metered: true, allowed: true, rule }
		: { metered: true, allowed: false, rule, response: throttledResponse(rule) };
}
