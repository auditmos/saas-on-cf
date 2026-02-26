import type { Client, ClientListResponse } from "@repo/data-ops/client";
import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";
import { getClientBinding, getClientsBinding } from "@/core/functions/clients/binding";
import { getClientDirect, getClientsDirect } from "@/core/functions/clients/direct";
import { fetchClient, fetchClients } from "./api-client";

type PaginationParams = { limit: number; offset: number };

interface EntityKeys {
	detail: (id: string) => readonly unknown[];
	list: (params: PaginationParams) => readonly unknown[];
}

interface EntityQueryConfig<TDetail, TList> {
	keys: EntityKeys;
	fns: {
		getOne: (id: string) => Promise<TDetail>;
		getList: (params: PaginationParams) => Promise<TList>;
	};
	overrides?: {
		detail?: Partial<UseQueryOptions>;
		list?: Partial<UseQueryOptions>;
	};
}

function createEntityQueryOptions<TDetail, TList>(config: EntityQueryConfig<TDetail, TList>) {
	return {
		detail: (id: string) =>
			queryOptions({
				queryKey: config.keys.detail(id),
				queryFn: () => config.fns.getOne(id),
				staleTime: 1000 * 60,
				...config.overrides?.detail,
			}),
		list: (params: PaginationParams) =>
			queryOptions({
				queryKey: config.keys.list(params),
				queryFn: () => config.fns.getList(params),
				placeholderData: (prev: TList | undefined) => prev,
				...config.overrides?.list,
			}),
	};
}

export const clientKeys = {
	all: ["clients"] as const,
	lists: () => [...clientKeys.all, "list"] as const,
	list: (params: PaginationParams, pattern: "direct" | "binding" | "api") =>
		[...clientKeys.lists(), params, pattern] as const,
	details: () => [...clientKeys.all, "detail"] as const,
	detail: (id: string, pattern: "direct" | "binding" | "api") =>
		[...clientKeys.details(), id, pattern] as const,
};

export const clientDirectQueries = createEntityQueryOptions<Client | null, ClientListResponse>({
	keys: {
		detail: (id) => clientKeys.detail(id, "direct"),
		list: (params) => clientKeys.list(params, "direct"),
	},
	fns: {
		getOne: (id) => getClientDirect({ data: { id } }),
		getList: (params) => getClientsDirect({ data: params }),
	},
});

export const clientBindingQueries = createEntityQueryOptions<Client | null, ClientListResponse>({
	keys: {
		detail: (id) => clientKeys.detail(id, "binding"),
		list: (params) => clientKeys.list(params, "binding"),
	},
	fns: {
		getOne: (id) => getClientBinding({ data: { id } }),
		getList: (params) => getClientsBinding({ data: params }),
	},
});

export const clientApiQueries = createEntityQueryOptions<Client | null, ClientListResponse>({
	keys: {
		detail: (id) => clientKeys.detail(id, "api"),
		list: (params) => clientKeys.list(params, "api"),
	},
	fns: {
		getOne: (id) => fetchClient(id),
		getList: (params) => fetchClients(params),
	},
});
