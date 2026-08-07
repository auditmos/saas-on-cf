import { enforceRateLimit, rateLimitHeaders } from "@repo/data-ops/rate-limit";

/**
 * Thin adapter over the shared rate-limit policy — the frontend's counterpart
 * to `data-service`'s Hono middleware. Both read the same rules, derive keys the
 * same way, and return the same throttled body, so a caller sees one behaviour
 * whichever Worker answers.
 *
 * It states no threshold. Which of this app's paths are metered, and how hard,
 * is decided in `@repo/data-ops/rate-limit` and nowhere else.
 *
 * Wraps the handler rather than running before it so a throttled caller never
 * reaches the renderer at all.
 */
export async function withRateLimit(
	request: Request,
	env: Record<string, unknown>,
	handle: () => Promise<Response>,
): Promise<Response> {
	const outcome = await enforceRateLimit({ worker: "user-application", request, env });

	if (!outcome.metered) return handle();
	if (!outcome.allowed) return outcome.response;

	const response = await handle();
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(rateLimitHeaders(outcome.rule))) {
		headers.set(name, value);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
