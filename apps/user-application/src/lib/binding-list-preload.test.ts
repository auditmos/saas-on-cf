import { createMemoryHistory } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { getAuthView } from "@/core/functions/auth/session";
import { getClientsBinding } from "@/core/functions/clients/binding";
import { getRouter } from "@/router";
import { clientKeys } from "./query-keys";

vi.mock("@/core/functions/auth/session", () => ({ getAuthView: vi.fn() }));
vi.mock(import("@/core/functions/clients/binding"), { spy: true });

it("reuses a preloaded binding list on navigation and refetches it after invalidation", async () => {
	vi.mocked(getAuthView).mockResolvedValue({ view: "authorized", email: null });
	vi.mocked(getClientsBinding).mockResolvedValue({
		data: [],
		pagination: { limit: 5, offset: 0, total: 0, hasMore: false },
	});
	const router = getRouter();
	const { queryClient } = router.options.context;
	router.update({
		context: { queryClient },
		history: createMemoryHistory(),
		isServer: false,
		origin: "http://localhost",
	});
	const list = { to: "/dashboard/binding/list" as const };

	await router.preloadRoute(list);
	expect(getClientsBinding).toHaveBeenCalledTimes(1);
	await router.navigate(list);
	expect(getClientsBinding).toHaveBeenCalledTimes(1);

	await queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
	await router.invalidate({ sync: true });
	expect(getClientsBinding).toHaveBeenCalledTimes(2);
});
