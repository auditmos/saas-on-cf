import { queryOptions } from "@tanstack/react-query";
import { getClientBinding, getClientsBinding } from "@/core/functions/clients/binding";
import { getClientDirect, getClientsDirect } from "@/core/functions/clients/direct";
import { fetchClient, fetchClients } from "./api-client";

type PaginationParams = { limit: number; offset: number };

// Base keys with pattern suffix
export const clientKeys = {
	all: ["clients"] as const,
	lists: () => [...clientKeys.all, "list"] as const,
	list: (params: PaginationParams, pattern: "direct" | "binding" | "api") =>
		[...clientKeys.lists(), params, pattern] as const,
	details: () => [...clientKeys.all, "detail"] as const,
	detail: (id: string, pattern: "direct" | "binding" | "api") =>
		[...clientKeys.details(), id, pattern] as const,
};

// ─────────────────────────────────────────────────────────────
// DIRECT PATTERN - Server Fn → data-ops → DB
// ─────────────────────────────────────────────────────────────

export const clientDetailDirectQueryOptions = (id: string) =>
	queryOptions({
		queryKey: clientKeys.detail(id, "direct"),
		queryFn: () => getClientDirect({ data: { id } }),
		staleTime: 1000 * 60,
	});

export const clientsListDirectQueryOptions = (params: PaginationParams) =>
	queryOptions({
		queryKey: clientKeys.list(params, "direct"),
		queryFn: () => getClientsDirect({ data: params }),
		placeholderData: (prev) => prev,
	});

// ─────────────────────────────────────────────────────────────
// BINDING PATTERN - Server Fn → DATA_SERVICE.fetch → data-service → DB
// ─────────────────────────────────────────────────────────────

export const clientDetailBindingQueryOptions = (id: string) =>
	queryOptions({
		queryKey: clientKeys.detail(id, "binding"),
		queryFn: () => getClientBinding({ data: { id } }),
		staleTime: 1000 * 60,
	});

export const clientsListBindingQueryOptions = (params: PaginationParams) =>
	queryOptions({
		queryKey: clientKeys.list(params, "binding"),
		queryFn: () => getClientsBinding({ data: params }),
		placeholderData: (prev) => prev,
	});

// ─────────────────────────────────────────────────────────────
// API PATTERN - Browser → fetch → data-service HTTP
// ─────────────────────────────────────────────────────────────

export const clientDetailApiQueryOptions = (id: string) =>
	queryOptions({
		queryKey: clientKeys.detail(id, "api"),
		queryFn: () => fetchClient(id),
		staleTime: 1000 * 60,
	});

export const clientsListApiQueryOptions = (params: PaginationParams) =>
	queryOptions({
		queryKey: clientKeys.list(params, "api"),
		queryFn: () => fetchClients(params),
		placeholderData: (prev) => prev,
	});
