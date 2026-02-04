import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import {
  UserSchema,
  UserCreateRequestSchema,
  UserUpdateRequestSchema,
  PaginationRequestSchema,
  UserListResponseSchema,
  type User,
  type UserListResponse,
  type UserCreateInput,
} from '@repo/data-ops/zod-schema/user';
import type { MutationResult, DeleteResult } from './types';

const makeBindingRequest = async (path: string, options: RequestInit = {}) => {
  return env.DATA_SERVICE.fetch(
    new Request(`https://data-service${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
        ...options.headers,
      },
      ...options,
    })
  );
};

// GET User
const GetUserInput = z.object({ id: z.string().min(1) });

export const getUserBinding = createServerFn()
  .inputValidator((data: z.infer<typeof GetUserInput>) => GetUserInput.parse(data))
  .handler(async (ctx): Promise<User | null> => {
    const response = await makeBindingRequest(`/users/${ctx.data.id}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch user');
    return UserSchema.parse(await response.json());
  });

// GET Users (paginated)
export const getUsersBinding = createServerFn()
  .inputValidator((data: z.infer<typeof PaginationRequestSchema>) => PaginationRequestSchema.parse(data))
  .handler(async (ctx): Promise<UserListResponse> => {
    const params = new URLSearchParams({
      limit: String(ctx.data.limit),
      offset: String(ctx.data.offset),
    });
    const response = await makeBindingRequest(`/users?${params}`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return UserListResponseSchema.parse(await response.json());
  });

// CREATE User
export const createUserBinding = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): UserCreateInput => UserCreateRequestSchema.parse(data))
  .handler(async (ctx): Promise<MutationResult> => {
    const response = await makeBindingRequest('/users', {
      method: 'POST',
      body: JSON.stringify(ctx.data),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      return {
        success: false,
        error: body.message || 'Failed to create user',
        code: body.code || 'API_ERROR',
      };
    }

    const user = UserSchema.parse(await response.json());
    return { success: true, user };
  });

// UPDATE User
const UpdateUserInput = z.object({
  id: z.string().min(1),
  data: UserUpdateRequestSchema,
});

export const updateUserBinding = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => UpdateUserInput.parse(data))
  .handler(async (ctx): Promise<MutationResult> => {
    const { id, data: updateData } = ctx.data;

    const response = await makeBindingRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      return {
        success: false,
        error: body.message || 'Failed to update user',
        code: body.code || 'API_ERROR',
      };
    }

    const user = UserSchema.parse(await response.json());
    return { success: true, user };
  });

// DELETE User
const DeleteUserInput = z.object({ id: z.string().min(1) });

export const deleteUserBinding = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => DeleteUserInput.parse(data))
  .handler(async (ctx): Promise<DeleteResult> => {
    const response = await makeBindingRequest(`/users/${ctx.data.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      return {
        success: false,
        error: body.message || 'Failed to delete user',
        code: body.code || 'API_ERROR',
      };
    }

    return { success: true };
  });
