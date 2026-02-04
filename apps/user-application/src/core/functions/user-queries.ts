import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { UserSchema, type User, type UserListResponseData, PaginationQuerySchema } from '@repo/data-ops/zod-schema/user';
import { getUser, getUsers } from '@repo/data-ops/queries/user';

const GetUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
});

type GetUserInputType = z.infer<typeof GetUserInput>;

/**
 * Get user by ID via data-ops directly
 * Data Flow: Browser → Server Function → data-ops → Response
 */
export const getUserDataOps = createServerFn()
  .inputValidator((data: GetUserInputType) => GetUserInput.parse(data))
  .handler(async (ctx): Promise<User | null> => {
    const { id } = ctx.data;
    const user = await getUser(id);
    return user ? UserSchema.parse(user) : null;
  });

const GetUsersInput = PaginationQuerySchema;
type GetUsersInputType = z.infer<typeof GetUsersInput>;

/**
 * Get paginated users via data-ops directly (same mock store as mutations)
 * Data Flow: Browser → Server Function → data-ops → Mock Store → Response
 */
export const getUsersDataOps = createServerFn()
  .inputValidator((data: GetUsersInputType) => GetUsersInput.parse(data))
  .handler(async (ctx): Promise<UserListResponseData> => {
    return getUsers(ctx.data);
  });
