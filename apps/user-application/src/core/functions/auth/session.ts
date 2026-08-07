import { getAuth } from "@repo/data-ops/auth/server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type AuthView, selectAuthView } from "@/core/auth-view";

export interface AuthViewResult {
	view: AuthView;
	email: string | null;
}

/**
 * Resolves the caller's own session so route guards can run on the server
 * before a protected route renders. `beforeLoad` runs in both environments, so
 * the session read has to be a server function rather than a direct call.
 *
 * Listed in PUBLIC_SERVER_FNS: an anonymous caller has to be able to reach this
 * to be told they are signed out. It discloses nothing beyond the caller's own
 * state — an anonymous request gets `{ view: "signed-out", email: null }`.
 */
export const getAuthView = createServerFn().handler(async (): Promise<AuthViewResult> => {
	const session = await getAuth().api.getSession(getRequest());

	return {
		view: selectAuthView(session),
		email: session?.user.email ?? null,
	};
});
