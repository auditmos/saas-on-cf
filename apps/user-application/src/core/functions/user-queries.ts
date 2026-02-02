import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getUser } from '@repo/data-ops/queries/user';
import { UserSchema, type User } from '@repo/data-ops/zod-schema/user';

const GetUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
});

type GetUserInputType = z.infer<typeof GetUserInput>;

/**
 * Get user by ID - Direct data-ops query
 * Data Flow: Browser → Server Function → data-ops → D1 → Response
 */
export const getUserDirect = createServerFn()
  .inputValidator((data: GetUserInputType) => GetUserInput.parse(data))
  .handler(async (ctx): Promise<User | null> => {
    const { id } = ctx.data;

    const user = await getUser(id);
    if (!user) {
      return null;
    }

    return UserSchema.parse(user);
  });
