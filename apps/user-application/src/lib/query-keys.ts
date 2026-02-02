import { queryOptions } from '@tanstack/react-query';
import { fetchUsers } from './api-client';

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
