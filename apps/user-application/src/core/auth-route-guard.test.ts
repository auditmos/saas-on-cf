import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The defect being fixed is that the access check ran too late — inside a React
 * effect, after the server had already rendered and returned the protected
 * content. So these assertions are made against the response the server
 * produces, not against browser navigation.
 *
 * `redirect()` returns a real `Response`, which is what `beforeLoad` throws and
 * what the Start handler returns to the client, so the response asserted on
 * here is the response the caller receives.
 */

const { mockGetAuthView } = vi.hoisted(() => ({ mockGetAuthView: vi.fn() }));

vi.mock("@/core/functions/auth/session", () => ({
	getAuthView: mockGetAuthView,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { signOut: vi.fn(), useSession: vi.fn() },
}));

async function loadRoute() {
	const mod = await import("@/routes/_auth/route");
	return mod.Route;
}

type BeforeLoad = (ctx: Record<string, unknown>) => Promise<unknown>;

async function runGuard(): Promise<{ thrown?: unknown; returned?: unknown }> {
	const route = await loadRoute();
	const beforeLoad = (route.options as { beforeLoad?: BeforeLoad }).beforeLoad;
	if (typeof beforeLoad !== "function") {
		throw new Error(
			"/_auth has no beforeLoad — the session check does not run on the server before the route renders",
		);
	}
	try {
		return { returned: await beforeLoad({ location: { href: "/app" } }) };
	} catch (thrown) {
		return { thrown };
	}
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("server-side guard on the protected layout", () => {
	it("answers an unauthenticated request with a redirect response rather than rendered content", async () => {
		mockGetAuthView.mockResolvedValue({ view: "signed-out", email: null });

		const { thrown, returned } = await runGuard();

		expect(returned, "the guard let an unauthenticated request through to render").toBeUndefined();
		expect(thrown).toBeInstanceOf(Response);
		expect(isRedirect(thrown)).toBe(true);

		const response = thrown as Response & { options: { to?: string; statusCode?: number } };
		expect(response.status).toBeGreaterThanOrEqual(300);
		expect(response.status).toBeLessThan(400);
		expect(response.options.to).toBe("/signin");
	});

	it("puts no protected-route content in the response body", async () => {
		mockGetAuthView.mockResolvedValue({ view: "signed-out", email: null });

		const { thrown } = await runGuard();
		const body = await (thrown as Response).text();

		expect(body).toBe("");
		expect(body).not.toMatch(/dashboard|sidebar|sign out/i);
	});

	it("lets an authenticated request render normally", async () => {
		mockGetAuthView.mockResolvedValue({ view: "authorized", email: "approved@example.com" });

		const { thrown, returned } = await runGuard();

		expect(thrown, "an authenticated request was redirected").toBeUndefined();
		expect(returned).toMatchObject({ auth: { view: "authorized" } });
	});

	it("does not redirect an account awaiting approval to the sign-in page", async () => {
		mockGetAuthView.mockResolvedValue({ view: "pending-approval", email: "pending@example.com" });

		const { thrown, returned } = await runGuard();

		expect(thrown, "a user awaiting approval was sent to sign in again").toBeUndefined();
		expect(returned).toMatchObject({ auth: { view: "pending-approval" } });
	});

	it("consults the session on every request rather than trusting a client-supplied value", async () => {
		mockGetAuthView.mockResolvedValue({ view: "authorized", email: "approved@example.com" });

		await runGuard();

		expect(mockGetAuthView).toHaveBeenCalledTimes(1);
	});
});
