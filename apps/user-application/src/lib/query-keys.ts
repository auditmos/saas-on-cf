import { queryOptions } from '@tanstack/react-query';
import { fetchUsers } from './api-client';

export const usersListQueryOptions = (params: { limit: number; offset: number }) =>
  queryOptions({
    queryKey: ['users', 'list', params] as const,
    queryFn: () => fetchUsers(params),
    placeholderData: (prev) => prev,
  });
