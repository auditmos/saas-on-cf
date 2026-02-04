import { eq, count } from 'drizzle-orm';
import { getDb } from '../database/setup';
import { users } from '../drizzle/schema';
import type {
  User,
  PaginationRequest,
  UserListResponse,
  UserUpdateInput,
  UserCreateInput
} from '../zod-schema/user';

export async function getUser(userId: string): Promise<User | null> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, userId));
  return result[0] ?? null;
}

export async function getUsers(params: PaginationRequest): Promise<UserListResponse> {
  const db = getDb();
  const [data, countResult] = await Promise.all([
    db.select().from(users).limit(params.limit).offset(params.offset),
    db.select({ total: count() }).from(users)
  ]);
  const total = countResult[0]?.total ?? 0;
  return {
    data,
    pagination: {
      total,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + data.length < total
    }
  };
}

export async function createUser(data: UserCreateInput): Promise<User> {
  const db = getDb();
  const [user] = await db.insert(users).values(data).returning();
  return user!;
}

export async function updateUser(
  userId: string,
  data: UserUpdateInput
): Promise<User | null> {
  const db = getDb();
  const result = await db.update(users).set(data).where(eq(users.id, userId)).returning();
  return result[0] ?? null;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(users).where(eq(users.id, userId)).returning();
  return result.length > 0;
}