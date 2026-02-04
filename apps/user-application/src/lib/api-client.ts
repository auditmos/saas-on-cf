import type {
  User,
  UserListResponse,
  PaginationRequest,
  UserCreateInput,
  UserUpdateInput,
} from '@repo/data-ops/zod-schema/user';
import { ErrorResponseSchema } from '@repo/data-ops/zod-schema/user';

const API_URL = import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8788';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

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

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const parsed = ErrorResponseSchema.safeParse(body);
    const errorData = parsed.success ? parsed.data : {};
    throw new ApiError(
      errorData.message || 'Request failed',
      response.status,
      errorData.code
    );
  }
  return response.json();
};

// GET User
export async function fetchUser(id: string): Promise<User | null> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (response.status === 404) return null;
  return handleResponse<User>(response);
}

// GET Users (paginated)
export async function fetchUsers(params: PaginationRequest): Promise<UserListResponse> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit ?? 10),
    offset: String(params.offset ?? 0),
  });

  const response = await fetch(`${API_URL}/users?${searchParams}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  return handleResponse<UserListResponse>(response);
}

// CREATE User
export async function createUserApi(data: UserCreateInput): Promise<User> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<User>(response);
}

// UPDATE User
export async function updateUserApi(id: string, data: UserUpdateInput): Promise<User> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<User>(response);
}

// DELETE User
export async function deleteUserApi(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const parsed = ErrorResponseSchema.safeParse(body);
    const errorData = parsed.success ? parsed.data : {};
    throw new ApiError(
      errorData.message || 'Failed to delete user',
      response.status,
      errorData.code
    );
  }
}
