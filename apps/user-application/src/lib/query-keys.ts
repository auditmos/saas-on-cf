import { queryOptions } from '@tanstack/react-query';
import { fetchUser, fetchUsers } from './api-client';
import { getUserDirect, getUsersDirect } from '@/core/functions/users/direct';
import { getUserBinding, getUsersBinding } from '@/core/functions/users/binding';

type PaginationParams = { limit: number; offset: number };

// Base keys with pattern suffix
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: PaginationParams, pattern: 'direct' | 'binding' | 'api') =>
    [...userKeys.lists(), params, pattern] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string, pattern: 'direct' | 'binding' | 'api') =>
    [...userKeys.details(), id, pattern] as const,
};

// ─────────────────────────────────────────────────────────────
// DIRECT PATTERN - Server Fn → data-ops → DB
// ─────────────────────────────────────────────────────────────

export const userDetailDirectQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id, 'direct'),
    queryFn: () => getUserDirect({ data: { id } }),
    staleTime: 1000 * 60,
  });

export const usersListDirectQueryOptions = (params: PaginationParams) =>
  queryOptions({
    queryKey: userKeys.list(params, 'direct'),
    queryFn: () => getUsersDirect({ data: params }),
    placeholderData: (prev) => prev,
  });

// ─────────────────────────────────────────────────────────────
// BINDING PATTERN - Server Fn → DATA_SERVICE.fetch → data-service → DB
// ─────────────────────────────────────────────────────────────

export const userDetailBindingQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id, 'binding'),
    queryFn: () => getUserBinding({ data: { id } }),
    staleTime: 1000 * 60,
  });

export const usersListBindingQueryOptions = (params: PaginationParams) =>
  queryOptions({
    queryKey: userKeys.list(params, 'binding'),
    queryFn: () => getUsersBinding({ data: params }),
    placeholderData: (prev) => prev,
  });

// ─────────────────────────────────────────────────────────────
// API PATTERN - Browser → fetch → data-service HTTP
// ─────────────────────────────────────────────────────────────

export const userDetailApiQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id, 'api'),
    queryFn: () => fetchUser(id),
    staleTime: 1000 * 60,
  });

export const usersListApiQueryOptions = (params: PaginationParams) =>
  queryOptions({
    queryKey: userKeys.list(params, 'api'),
    queryFn: () => fetchUsers(params),
    placeholderData: (prev) => prev,
  });
