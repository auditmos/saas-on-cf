import type {
  User,
  UserCreateInput,
  UserUpdateInput,
  PaginationRequest,
  UserListResponse
} from '@repo/data-ops/zod-schema/user';
import {
  getUser,
  getUsers as getUsersQuery,
  createUser as createUserQuery,
  updateUser as updateUserQuery,
  deleteUser as deleteUserQuery
} from '@repo/data-ops/queries/user';
import { HTTPException } from 'hono/http-exception';

export async function getUsers(params: PaginationRequest): Promise<UserListResponse> {
  return getUsersQuery(params);
}

export async function getUserById(id: string): Promise<User> {
  const user = await getUser(id);
  if (!user) throw new HTTPException(404, { message: 'User not found' });
  return user;
}

export async function createUser(data: UserCreateInput): Promise<User> {
  try {
    return await createUserQuery(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      throw new HTTPException(409, { message: 'Email already exists' });
    }
    throw error;
  }
}

export async function updateUser(id: string, data: UserUpdateInput): Promise<User> {
  try {
    const user = await updateUserQuery(id, data);
    if (!user) throw new HTTPException(404, { message: 'User not found' });
    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      throw new HTTPException(409, { message: 'Email already exists' });
    }
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  const deleted = await deleteUserQuery(id);
  if (!deleted) throw new HTTPException(404, { message: 'User not found' });
}
