import type {
  User,
  UserCreateInput,
  UserUpdateInput,
  PaginationQuery,
  UserListResponseData
} from '@repo/data-ops/zod-schema/user';
import { mockUsers } from '@repo/data-ops/mocks/user-mock';
import { HTTPException } from 'hono/http-exception';

export async function getUsers(params: PaginationQuery): Promise<UserListResponseData> {
  return mockUsers.getPaginated(params);
}

export async function getUserById(id: string): Promise<User> {
  const user = mockUsers.findById(id);
  if (!user) throw new HTTPException(404, { message: 'User not found' });
  return user;
}

export async function createUser(data: UserCreateInput): Promise<User> {
  if (mockUsers.findByEmail(data.email)) {
    throw new HTTPException(409, { message: 'Email already exists' });
  }
  return mockUsers.create(data);
}

export async function updateUser(id: string, data: UserUpdateInput): Promise<User> {
  const existing = mockUsers.findById(id);
  if (!existing) throw new HTTPException(404, { message: 'User not found' });

  if (data.email && data.email !== existing.email && mockUsers.findByEmail(data.email)) {
    throw new HTTPException(409, { message: 'Email already exists' });
  }

  return mockUsers.update(id, data);
}

export async function deleteUser(id: string): Promise<void> {
  if (!mockUsers.findById(id)) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  mockUsers.delete(id);
}
