/**
 * PUBLIC_SERVER_FN — the complete public surface of this application's server
 * functions.
 *
 * TanStack Start server functions are public HTTP endpoints. Every server
 * function in this app is authenticated by default: `startInstance` registers
 * `protectedFunctionMiddleware` as global `functionMiddleware`, so the check
 * runs for every function whether or not its author wrote any auth code.
 *
 * Listing a function here is the ONLY way to expose it to anonymous callers.
 * It is deliberately verbose and deliberately central: `grep PUBLIC_SERVER_FN`
 * enumerates the entire anonymous-reachable surface of the app in one search.
 *
 * Adding an entry also fails `scripts/server-fn-enumeration.test.ts` until the
 * expected list in that test is updated, so opening an endpoint cannot happen
 * without a reviewer seeing it.
 */

export interface PublicServerFn {
	/** Source file, relative to the app root, as the Start compiler reports it. */
	filename: string;
	/** Exported name of the server function. */
	name: string;
	/** Why this endpoint must be reachable without a session. */
	reason: string;
}

export const PUBLIC_SERVER_FNS: readonly PublicServerFn[] = [
	{
		filename: "src/core/functions/auth/session.ts",
		name: "getAuthView",
		reason:
			"The protected layout's server-side guard calls this to decide whether to redirect. An anonymous caller must be able to reach it to be told they are signed out. It returns only the caller's own session state.",
	},
];

/** Identity the Start compiler attaches to every server function. */
export interface ServerFnIdentity {
	name?: string;
	filename?: string;
}

/**
 * Fails closed: an unidentifiable function is treated as protected. A missing
 * or partial identity means the compiler metadata is absent, which is a reason
 * to deny rather than to allow.
 */
export function isPublicServerFn(
	meta: ServerFnIdentity | undefined,
	entries: readonly PublicServerFn[] = PUBLIC_SERVER_FNS,
): boolean {
	if (!meta?.name || !meta.filename) return false;
	return entries.some((entry) => entry.name === meta.name && entry.filename === meta.filename);
}
