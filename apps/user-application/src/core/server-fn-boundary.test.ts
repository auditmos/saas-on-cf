import type { AsyncLocalStorage } from "node:async_hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env, resetTestEnv } from "@/test/cloudflare-workers";

/**
 * The Vite compiler rewrites `.handler(impl)` into `.handler(rpcStub, impl)` for
 * the server build; only the second argument runs server-side. Vitest does not
 * run that transform, so without this shim every handler body would be a no-op
 * and "the database was never touched" would assert nothing. This mock supplies
 * the second argument so handler bodies really execute.
 */
vi.mock("@tanstack/react-start", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-start")>();
	type ChainNode = Record<string, unknown>;
	const CHAINING = new Set(["middleware", "inputValidator", "validator"]);

	const compileLike = (node: ChainNode): ChainNode =>
		new Proxy(node, {
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver);
				if (typeof value !== "function") return value;
				if (prop === "handler") {
					return (impl: unknown) =>
						(value as (...a: unknown[]) => unknown).call(target, impl, impl);
				}
				if (CHAINING.has(prop as string)) {
					return (...args: unknown[]) =>
						compileLike((value as (...a: unknown[]) => ChainNode).apply(target, args));
				}
				return value;
			},
		});

	return {
		...actual,
		createServerFn: (...args: unknown[]) =>
			compileLike((actual.createServerFn as unknown as (...a: unknown[]) => ChainNode)(...args)),
	};
});

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

const dbSpies = vi.hoisted(() => ({
	getClient: vi.fn(),
	getClients: vi.fn(),
	createClient: vi.fn(),
	updateClient: vi.fn(),
	deleteClient: vi.fn(),
}));

vi.mock("@repo/data-ops/client", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, ...dbSpies };
});

// --- invocation harness -----------------------------------------------------

const START_STORAGE_KEY = Symbol.for("tanstack-start:start-storage-context");

type ServerFn = {
	__executeServer: (opts: {
		data: unknown;
		context: Record<string, unknown>;
		method: string;
	}) => Promise<{ result?: unknown; error?: unknown }>;
};

async function invoke(fn: unknown, data: unknown) {
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
			(fn as ServerFn).__executeServer({
				data,
				context: {},
				method: "POST",
			}),
	);
}

function errorOf(outcome: { error?: unknown }): { code?: string; message?: string } {
	const error = outcome.error as { code?: string; message?: string } | undefined;
	return error ?? {};
}

const APPROVED_SESSION = {
	user: { id: "user_1", email: "approved@example.com", approved: true },
};

const EMPTY_LIST = {
	data: [],
	pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
};

// --- the client-facing surface ---------------------------------------------

type Case = { name: string; kind: "read" | "mutation"; data: unknown };

const DIRECT_CASES: Case[] = [
	{ name: "getClientDirect", kind: "read", data: { id: "client_1" } },
	{ name: "getClientsDirect", kind: "read", data: { limit: 20, offset: 0 } },
	{ name: "createClientDirect", kind: "mutation", data: { name: "A", email: "a@example.com" } },
	{ name: "updateClientDirect", kind: "mutation", data: { id: "client_1", data: { name: "B" } } },
	{ name: "deleteClientDirect", kind: "mutation", data: { id: "client_1" } },
];

const BINDING_CASES: Case[] = [
	{ name: "getClientBinding", kind: "read", data: { id: "client_1" } },
	{ name: "getClientsBinding", kind: "read", data: { limit: 20, offset: 0 } },
	{ name: "createClientBinding", kind: "mutation", data: { name: "A", email: "a@example.com" } },
	{ name: "updateClientBinding", kind: "mutation", data: { id: "client_1", data: { name: "B" } } },
	{ name: "deleteClientBinding", kind: "mutation", data: { id: "client_1" } },
];

async function loadDirect(name: string) {
	const mod = (await import("@/core/functions/clients/direct")) as Record<string, unknown>;
	return mod[name];
}

async function loadBinding(name: string) {
	const mod = (await import("@/core/functions/clients/binding")) as Record<string, unknown>;
	return mod[name];
}

beforeEach(() => {
	vi.clearAllMocks();
	resetTestEnv();
	mockGetSession.mockResolvedValue(null);
});

describe("server-function boundary — anonymous callers", () => {
	it.each(
		DIRECT_CASES,
	)("$name ($kind, direct DB) rejects a request with no session and never touches the database", async ({
		name,
		data,
	}) => {
		const outcome = await invoke(await loadDirect(name), data);

		expect(errorOf(outcome).code, `${name} allowed an anonymous caller`).toBe("UNAUTHENTICATED");
		for (const [query, spy] of Object.entries(dbSpies)) {
			expect(
				spy,
				`${name}: anonymous request reached the database via ${query}()`,
			).not.toHaveBeenCalled();
		}
	});

	it.each(
		BINDING_CASES,
	)("$name ($kind, service binding) rejects a request with no session before the privileged token is attached", async ({
		name,
		data,
	}) => {
		const upstream = vi.fn();
		env.DATA_SERVICE = { fetch: upstream };

		const outcome = await invoke(await loadBinding(name), data);

		expect(errorOf(outcome).code, `${name} allowed an anonymous caller`).toBe("UNAUTHENTICATED");
		expect(
			upstream,
			`${name}: the upstream service received a request, so the privileged bearer token was attached to an unauthenticated call`,
		).not.toHaveBeenCalled();
	});
});

describe("server-function boundary — positive control", () => {
	it("an approved session reaches the database (proves the anonymous assertions are not vacuous)", async () => {
		mockGetSession.mockResolvedValue(APPROVED_SESSION);
		dbSpies.getClients.mockResolvedValue(EMPTY_LIST);

		const outcome = await invoke(await loadDirect("getClientsDirect"), { limit: 20, offset: 0 });

		expect(outcome.error).toBeUndefined();
		expect(dbSpies.getClients).toHaveBeenCalledTimes(1);
	});

	it("an approved session reaches the upstream service with the privileged token", async () => {
		mockGetSession.mockResolvedValue(APPROVED_SESSION);
		const upstream = vi.fn(async (_request: Request) => Response.json(EMPTY_LIST));
		env.DATA_SERVICE = { fetch: upstream };

		const outcome = await invoke(await loadBinding("getClientsBinding"), { limit: 20, offset: 0 });

		expect(outcome.error).toBeUndefined();
		expect(upstream).toHaveBeenCalledTimes(1);
		const sent = upstream.mock.calls[0]?.[0];
		expect(sent?.headers.get("Authorization")).toBe("Bearer test-privileged-upstream-token");
	});
});

describe("server-function boundary — an account awaiting approval", () => {
	const UNAPPROVED_SESSION = {
		user: { id: "user_2", email: "pending@example.com", approved: false },
	};

	beforeEach(() => {
		mockGetSession.mockResolvedValue(UNAPPROVED_SESSION);
	});

	it.each(
		DIRECT_CASES,
	)("$name (direct DB) rejects an unapproved account and never touches the database", async ({
		name,
		data,
	}) => {
		const outcome = await invoke(await loadDirect(name), data);

		expect(errorOf(outcome).code).toBe("NOT_APPROVED");
		for (const [query, spy] of Object.entries(dbSpies)) {
			expect(
				spy,
				`${name}: unapproved request reached the database via ${query}()`,
			).not.toHaveBeenCalled();
		}
	});

	it.each(
		BINDING_CASES,
	)("$name (service binding) rejects an unapproved account before the privileged token is attached", async ({
		name,
		data,
	}) => {
		const upstream = vi.fn();
		env.DATA_SERVICE = { fetch: upstream };

		const outcome = await invoke(await loadBinding(name), data);

		expect(errorOf(outcome).code).toBe("NOT_APPROVED");
		expect(upstream).not.toHaveBeenCalled();
	});

	it("is distinguishable from the unauthenticated case in both code and HTTP status", async () => {
		const { setResponseStatus } = await import("@tanstack/react-start/server");
		const statusSpy = vi.mocked(setResponseStatus);

		mockGetSession.mockResolvedValue(null);
		const anonymous = await invoke(await loadDirect("getClientsDirect"), { limit: 20, offset: 0 });
		const anonymousStatus = statusSpy.mock.calls.at(-1)?.[0];

		mockGetSession.mockResolvedValue(UNAPPROVED_SESSION);
		const pending = await invoke(await loadDirect("getClientsDirect"), { limit: 20, offset: 0 });
		const pendingStatus = statusSpy.mock.calls.at(-1)?.[0];

		expect(errorOf(anonymous).code).toBe("UNAUTHENTICATED");
		expect(anonymousStatus).toBe(401);

		expect(errorOf(pending).code).toBe("NOT_APPROVED");
		expect(pendingStatus).toBe(403);

		// The whole point: a caller awaiting approval must not be told they are
		// signed out, or the interface shows them a signed-out experience.
		expect(errorOf(pending).code).not.toBe(errorOf(anonymous).code);
	});
});
