import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  UserSchema,
  UserCreateRequestSchema,
  UserUpdateRequestSchema,
  PaginationRequestSchema,
  type User,
  type UserListResponse,
  type UserCreateInput,
} from '@repo/data-ops/zod-schema/user';
import { getUser, getUsers, createUser, updateUser, deleteUser } from '@repo/data-ops/queries/user';
import type { MutationResult, DeleteResult } from './types';

// GET User
const GetUserInput = z.object({ id: z.string().min(1) });

export const getUserDirect = createServerFn()
  .inputValidator((data: z.infer<typeof GetUserInput>) => GetUserInput.parse(data))
  .handler(async (ctx): Promise<User | null> => {
    const user = await getUser(ctx.data.id);
    return user ? UserSchema.parse(user) : null;
  });

// GET Users (paginated)
export const getUsersDirect = createServerFn()
  .inputValidator((data: z.infer<typeof PaginationRequestSchema>) => PaginationRequestSchema.parse(data))
  .handler(async (ctx): Promise<UserListResponse> => {
    return getUsers(ctx.data);
  });

// CREATE User
export const createUserDirect = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): UserCreateInput => UserCreateRequestSchema.parse(data))
  .handler(async (ctx): Promise<MutationResult> => {
    try {
      const user = await createUser(ctx.data);
      return { success: true, user: UserSchema.parse(user) };
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate')) {
        return { success: false, error: 'Email already exists', code: 'EMAIL_EXISTS', field: 'email' };
      }
      return { success: false, error: 'Failed to create user', code: 'UNKNOWN' };
    }
  });

// UPDATE User
const UpdateUserInput = z.object({
  id: z.string().min(1),
  data: UserUpdateRequestSchema,
});

export const updateUserDirect = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => UpdateUserInput.parse(data))
  .handler(async (ctx): Promise<MutationResult> => {
    const { id, data: updateData } = ctx.data;

    try {
      const targetUser = await getUser(id);
      if (!targetUser) {
        return { success: false, error: 'User not found', code: 'NOT_FOUND' };
      }

      const updated = await updateUser(id, updateData);
      if (!updated) {
        return { success: false, error: 'Failed to update user', code: 'UPDATE_FAILED' };
      }

      return { success: true, user: UserSchema.parse(updated) };
    } catch (error) {
      if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
        return { success: false, error: 'Email already in use', code: 'EMAIL_EXISTS', field: 'email' };
      }
      return { success: false, error: 'Failed to update user', code: 'UNKNOWN' };
    }
  });

// DELETE User
const DeleteUserInput = z.object({ id: z.string().min(1) });

export const deleteUserDirect = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => DeleteUserInput.parse(data))
  .handler(async (ctx): Promise<DeleteResult> => {
    const { id } = ctx.data;

    const targetUser = await getUser(id);
    if (!targetUser) {
      return { success: false, error: 'User not found', code: 'NOT_FOUND' };
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return { success: false, error: 'Failed to delete user', code: 'DELETE_FAILED' };
    }

    return { success: true };
  });
