import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/errors";
import {
	createClientApi,
	deleteClientApi,
	fetchClient,
	fetchClients,
	updateClientApi,
} from "./api-client";

function mockFetch(makeResponse: () => Response) {
	const spy = vi.fn().mockImplementation(async () => makeResponse());
	vi.stubGlobal("fetch", spy);
	return spy;
}

const unauthorized = (): Response =>
	new Response(JSON.stringify({ message: "Unauthorized", code: "UNAUTHORIZED" }), {
		status: 401,
		headers: { "Content-Type": "application/json" },
	});

const okClient = (): Response =>
	new Response(
		JSON.stringify({
			id: "00000000-0000-4000-8000-000000000000",
			name: "n",
			surname: "s",
			email: "e@e.com",
			active: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);

const okClientList = (): Response =>
	new Response(JSON.stringify({ data: [], pagination: { limit: 10, offset: 0, total: 0 } }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("api-client carries auth via session cookie, never a bundled token", () => {
	it("sends credentials: include on every request (no bundled bearer)", async () => {
		const spy = mockFetch(okClient);

		await fetchClient("x");
		await createClientApi({
			name: "n",
			surname: "s",
			email: "e@e.com",
		} as Parameters<typeof createClientApi>[0]);
		await updateClientApi("x", { name: "n" } as Parameters<typeof updateClientApi>[1]);

		// fetchClients needs its own list-shaped response
		vi.unstubAllGlobals();
		const listSpy = mockFetch(okClientList);
		await fetchClients({ limit: 10, offset: 0 });

		for (const call of [...spy.mock.calls, ...listSpy.mock.calls]) {
			const init = call[1] as RequestInit;
			expect(init.credentials, "every browser fetch must include cookies").toBe("include");
		}
	});

	it("never attaches an Authorization header from the bundle", async () => {
		const spy = mockFetch(okClient);

		await fetchClient("x");
		await createClientApi({
			name: "n",
			surname: "s",
			email: "e@e.com",
		} as Parameters<typeof createClientApi>[0]);

		for (const call of spy.mock.calls) {
			const init = call[1] as RequestInit;
			const headers = new Headers(init.headers);
			expect(headers.has("Authorization"), "no bearer token must be sent from browser code").toBe(
				false,
			);
		}
	});
});

describe("api-client surfaces 401 from missing session cookie as a typed AppError", () => {
	it("fetchClient throws AppError(status=401) when backend rejects", async () => {
		mockFetch(unauthorized);
		await expect(fetchClient("x")).rejects.toBeInstanceOf(AppError);
		await expect(fetchClient("x")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
	});

	it("fetchClients throws AppError(status=401) when backend rejects", async () => {
		mockFetch(unauthorized);
		await expect(fetchClients({ limit: 10, offset: 0 })).rejects.toBeInstanceOf(AppError);
		await expect(fetchClients({ limit: 10, offset: 0 })).rejects.toMatchObject({
			status: 401,
			code: "UNAUTHORIZED",
		});
	});

	it("createClientApi throws AppError(status=401) when backend rejects", async () => {
		mockFetch(unauthorized);
		const input = { name: "n", surname: "s", email: "e@e.com" } as Parameters<
			typeof createClientApi
		>[0];
		await expect(createClientApi(input)).rejects.toBeInstanceOf(AppError);
		await expect(createClientApi(input)).rejects.toMatchObject({
			status: 401,
			code: "UNAUTHORIZED",
		});
	});

	it("updateClientApi throws AppError(status=401) when backend rejects", async () => {
		mockFetch(unauthorized);
		const input = { name: "n" } as Parameters<typeof updateClientApi>[1];
		await expect(updateClientApi("x", input)).rejects.toBeInstanceOf(AppError);
		await expect(updateClientApi("x", input)).rejects.toMatchObject({
			status: 401,
			code: "UNAUTHORIZED",
		});
	});

	it("deleteClientApi throws AppError(status=401) when backend rejects", async () => {
		mockFetch(unauthorized);
		await expect(deleteClientApi("x")).rejects.toBeInstanceOf(AppError);
		await expect(deleteClientApi("x")).rejects.toMatchObject({
			status: 401,
			code: "UNAUTHORIZED",
		});
	});
});
