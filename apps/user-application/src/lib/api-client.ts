import type { UserListResponseData, PaginationQuery } from '@repo/data-ops/zod-schema/user';
import { ApiErrorResponseSchema } from '@repo/data-ops/zod-schema/user';

const API_URL = import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8788';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchUsers(params: PaginationQuery): Promise<UserListResponseData> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit ?? 10),
    offset: String(params.offset ?? 0),
  });

  const response = await fetch(`${API_URL}/users?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const parsed = ApiErrorResponseSchema.safeParse(body);
    const errorData = parsed.success ? parsed.data : {};
    throw new ApiError(
      errorData.message || 'Failed to fetch users',
      response.status,
      errorData.code
    );
  }

  return response.json();
}
