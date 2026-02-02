import { mockUsers } from '../mocks/user-mock';
import type {
  User,
  PaginationQuery,
  UserListResponseData,
  UserUpdateInput
} from '../zod-schema/user';

/**
 * Get user by ID
 * Currently uses mock, will use Neon database later
 */
export async function getUser(userId: string): Promise<User | null> {
  return mockUsers.findById(userId) ?? null;
}

/**
 * Get paginated users
 */
export async function getUsers(params: PaginationQuery): Promise<UserListResponseData> {
  return mockUsers.getPaginated(params);
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  data: UserUpdateInput
): Promise<User | null> {
  const existing = mockUsers.findById(userId);
  if (!existing) return null;

  if (data.email && data.email !== existing.email) {
    const emailExists = mockUsers.findByEmail(data.email);
    if (emailExists) throw new Error('EMAIL_EXISTS');
  }

  return mockUsers.update(userId, data);
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const user = mockUsers.findById(userId);
  if (!user) return false;
  mockUsers.delete(userId);
  return true;
}