/**
 * Which experience a caller should be shown, decided in one place so the client
 * and the server cannot disagree about it.
 *
 * Deliberately client-safe — no server-only imports — because both the route
 * component and the server-side guard need it. Kept as a discriminated value
 * rather than a boolean so "signed out" and "waiting for approval" cannot
 * collapse into each other: a user awaiting approval who is shown a signed-out
 * screen will keep trying to sign in at a problem signing in will not fix.
 */
export type AuthView = "signed-out" | "pending-approval" | "authorized";

/**
 * Accepts `unknown` deliberately. Better Auth does not surface `additionalFields`
 * such as `approved` on its session type, so every caller would otherwise cast
 * at the call site — and a cast repeated in several places is a cast that will
 * eventually be written wrong.
 */
export function selectAuthView(session: unknown): AuthView {
	const user = (session as { user?: Record<string, unknown> | null } | null | undefined)?.user;
	if (!user) return "signed-out";
	return user.approved === true ? "authorized" : "pending-approval";
}
