import { getAuth } from "@repo/data-ops/auth/server";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { selectAuthView } from "@/core/auth-view";
import { AppError } from "@/core/errors";
import { isPublicServerFn, type ServerFnIdentity } from "@/core/public-server-fns";

/**
 * Kept distinct so callers can tell "you are signed out" from "your account is
 * not approved yet" — the interface renders a pending-approval state for the
 * second, not a signed-out one.
 */
const AUTH_ERROR_CODES = {
	UNAUTHENTICATED: "UNAUTHENTICATED",
	NOT_APPROVED: "NOT_APPROVED",
} as const;

/**
 * Handed to every server function. Both branches carry the same shape so a
 * handler cannot accidentally read an approved caller's identity off a request
 * that was let through as public.
 */
interface ServerFnAuthContext {
	auth: { status: "public" } | { status: "authorized"; userId: string; email: string };
}

/**
 * Resolves the caller's session and approval state, or throws. Throwing rather
 * than returning a union is deliberate: this runs inside middleware, where the
 * only safe default on any failure is to stop the chain before the handler —
 * and, on the service-binding path, before the privileged upstream token is
 * ever attached.
 */
async function requireApprovedSession(): Promise<{ userId: string; email: string }> {
	const auth = getAuth();
	const session = await auth.api.getSession(getRequest());

	if (!session) {
		setResponseStatus(401);
		throw new AppError("Authentication required", AUTH_ERROR_CODES.UNAUTHENTICATED, 401);
	}

	if (selectAuthView(session) !== "authorized") {
		setResponseStatus(403);
		throw new AppError("Account pending approval", AUTH_ERROR_CODES.NOT_APPROVED, 403);
	}

	return { userId: session.user.id, email: session.user.email };
}

/**
 * Registered as global `functionMiddleware` on `startInstance`, so it guards
 * every server function in the app by default — including ones written with no
 * auth-related code at all. The only way past it is an entry in
 * `PUBLIC_SERVER_FNS`.
 */
export const protectedFunctionMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next, serverFnMeta }) => {
		const context: ServerFnAuthContext = isPublicServerFn(
			serverFnMeta as ServerFnIdentity | undefined,
		)
			? { auth: { status: "public" } }
			: { auth: { status: "authorized", ...(await requireApprovedSession()) } };

		return next({ context });
	},
);
