import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockBetterAuthHandler } = vi.hoisted(() => ({
	mockBetterAuthHandler: vi.fn(),
}));

vi.mock("@repo/data-ops/auth/server", () => ({
	getAuth: () => ({ handler: mockBetterAuthHandler }),
}));

async function loadRoute() {
	const mod = await import("../routes/api/auth.$");
	return mod.Route;
}

type Method = "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS";

function getHandler(route: Awaited<ReturnType<typeof loadRoute>>, method: Method) {
	const handlers = (
		route.options as {
			server?: { handlers?: Record<string, unknown> };
		}
	).server?.handlers;
	const candidate = handlers?.[method] ?? handlers?.ANY;
	if (typeof candidate !== "function") {
		throw new Error(
			`No handler registered for ${method}; handlers=${JSON.stringify(Object.keys(handlers ?? {}))}`,
		);
	}
	return candidate as (ctx: { request: Request }) => Promise<Response> | Response;
}

describe("/api/auth/$ catch-all route", () => {
	beforeEach(() => {
		mockBetterAuthHandler.mockReset();
	});

	it.each<{ method: Method; path: string; status: number }>([
		{ method: "GET", path: "/api/auth/session", status: 200 },
		{ method: "POST", path: "/api/auth/sign-in/email", status: 200 },
		{ method: "PUT", path: "/api/auth/user/update", status: 200 },
		{ method: "DELETE", path: "/api/auth/sessions/abc123", status: 204 },
		{ method: "OPTIONS", path: "/api/auth/sign-in/email", status: 204 },
	])("forwards $method $path to Better Auth's handler (preserves the original Request)", async ({
		method,
		path,
		status,
	}) => {
		const expected = new Response(null, { status });
		mockBetterAuthHandler.mockResolvedValueOnce(expected);

		const route = await loadRoute();
		const handler = getHandler(route, method);
		const request = new Request(`http://localhost${path}`, { method });

		const response = await handler({ request });

		expect(mockBetterAuthHandler).toHaveBeenCalledTimes(1);
		// Same Request reference — Better Auth reads the body stream; re-wrapping would break it.
		expect(mockBetterAuthHandler.mock.calls[0]?.[0]).toBe(request);
		expect(response).toBe(expected);
	});
});
