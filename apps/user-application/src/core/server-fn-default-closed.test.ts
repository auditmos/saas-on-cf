import type { AsyncLocalStorage } from "node:async_hooks";
import { createServerFn } from "@tanstack/react-start";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPublicServerFn, type PublicServerFn } from "@/core/public-server-fns";

/**
 * Proves the wrapper is a *default* and not a convention: a server function
 * written with no auth-related code whatsoever must still reject anonymous
 * callers, purely because of how the app is wired.
 */

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@repo/data-ops/auth/server", () => ({
	getAuth: () => ({ api: { getSession: mockGetSession } }),
}));

vi.mock("@tanstack/react-start/server", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		getRequest: () => new Request("https://app.example.com/_serverFn/test"),
		setResponseStatus: vi.fn(),
	};
});

const PUBLIC_FIXTURE: PublicServerFn[] = [
	{ filename: "src/core/functions/fixture.ts", name: "openFn", reason: "test fixture" },
];

vi.mock("@/core/public-server-fns", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/core/public-server-fns")>();
	return {
		...actual,
		isPublicServerFn: (meta: { name?: string; filename?: string } | undefined) =>
			actual.isPublicServerFn(meta, PUBLIC_FIXTURE),
	};
});

const START_STORAGE_KEY = Symbol.for("tanstack-start:start-storage-context");

type ServerFnMeta = { id: string; name: string; filename: string };

/**
 * Builds a server function the way the Start compiler does on the server build:
 * the handler body is passed as the server implementation and carries the
 * identity metadata the middleware uses to look up the public marker.
 */
function compiledServerFn(meta: ServerFnMeta | undefined, impl: () => Promise<unknown>) {
	const extracted = Object.assign(impl, meta ? { serverFnMeta: meta } : {});
	return (
		createServerFn() as unknown as {
			handler: (a: unknown, b: unknown) => unknown;
		}
	).handler(extracted, extracted);
}

async function invoke(fn: unknown) {
	const { startInstance } = await import("@/start");
	const startOptions = await startInstance.getOptions();
	const storage = (globalThis as unknown as Record<symbol, AsyncLocalStorage<unknown>>)[
		START_STORAGE_KEY
	];
	if (!storage) throw new Error("TanStack Start storage context is not registered");
	return storage.run(
		{
			startOptions,
			request: new Request("https://app.example.com/_serverFn/test"),
			contextAfterGlobalMiddlewares: {},
			executedRequestMiddlewares: new Set(),
		},
		() =>
			(
				fn as {
					__executeServer: (o: unknown) => Promise<{ result?: unknown; error?: unknown }>;
				}
			).__executeServer({ data: undefined, context: {}, method: "POST" }),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockGetSession.mockResolvedValue(null);
});

describe("default-closed on newly written code", () => {
	it("rejects an anonymous caller to a brand-new server function containing no auth code", async () => {
		const handlerRan = vi.fn();
		// Deliberately written the way an author unaware of the auth boundary
		// would write it: no middleware, no session check, nothing.
		const newlyAddedFn = compiledServerFn(
			{ id: "new", name: "newlyAddedFn", filename: "src/core/functions/newly-added.ts" },
			async () => {
				handlerRan();
				return "secret";
			},
		);

		const outcome = await invoke(newlyAddedFn);

		expect((outcome.error as { code?: string } | undefined)?.code).toBe("UNAUTHENTICATED");
		expect(handlerRan).not.toHaveBeenCalled();
		expect(outcome.result).toBeUndefined();
	});

	it("rejects a server function the compiler could not identify (fails closed on missing metadata)", async () => {
		const handlerRan = vi.fn();
		const unidentifiedFn = compiledServerFn(undefined, async () => {
			handlerRan();
			return "secret";
		});

		const outcome = await invoke(unidentifiedFn);

		expect((outcome.error as { code?: string } | undefined)?.code).toBe("UNAUTHENTICATED");
		expect(handlerRan).not.toHaveBeenCalled();
	});
});

describe("the public marker is the only opt-out", () => {
	it("allows an anonymous caller to a function listed in PUBLIC_SERVER_FNS", async () => {
		const handlerRan = vi.fn();
		const openFn = compiledServerFn(
			{ id: "open", name: "openFn", filename: "src/core/functions/fixture.ts" },
			async () => {
				handlerRan();
				return "public payload";
			},
		);

		const outcome = await invoke(openFn);

		expect(outcome.error).toBeUndefined();
		expect(handlerRan).toHaveBeenCalledTimes(1);
		expect(outcome.result).toBe("public payload");
	});

	it("does not open a function that merely shares a name with a public entry in another file", async () => {
		const impostor = compiledServerFn(
			{ id: "impostor", name: "openFn", filename: "src/core/functions/clients/direct.ts" },
			async () => "secret",
		);

		const outcome = await invoke(impostor);

		expect((outcome.error as { code?: string } | undefined)?.code).toBe("UNAUTHENTICATED");
	});
});

describe("isPublicServerFn", () => {
	it("fails closed on absent or partial identity", () => {
		expect(isPublicServerFn(undefined, PUBLIC_FIXTURE)).toBe(false);
		expect(isPublicServerFn({ name: "openFn" }, PUBLIC_FIXTURE)).toBe(false);
		expect(isPublicServerFn({ filename: "src/core/functions/fixture.ts" }, PUBLIC_FIXTURE)).toBe(
			false,
		);
	});

	it("matches only on the exact file and name pair", () => {
		expect(
			isPublicServerFn(
				{ name: "openFn", filename: "src/core/functions/fixture.ts" },
				PUBLIC_FIXTURE,
			),
		).toBe(true);
		expect(
			isPublicServerFn(
				{ name: "otherFn", filename: "src/core/functions/fixture.ts" },
				PUBLIC_FIXTURE,
			),
		).toBe(false);
	});
});
