import { queryOptions } from '@tanstack/react-query';
import { fetchUsers } from './api-client';
import { getUserDataOps, getUsersDataOps } from '@/core/functions/user-queries';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: { limit: number; offset: number }) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const usersListQueryOptions = (params: { limit: number; offset: number }) =>
  queryOptions({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsers(params),
    placeholderData: (prev) => prev,
  });

export const usersListDataOpsQueryOptions = (params: { limit: number; offset: number }) =>
  queryOptions({
    queryKey: userKeys.list(params),
    queryFn: () => getUsersDataOps({ data: params }),
    placeholderData: (prev) => prev,
  });

export const userDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: () => getUserDataOps({ data: { id } }),
    staleTime: 1000 * 60,
  });
