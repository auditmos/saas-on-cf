import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getUser, updateUser } from '@repo/data-ops/queries/user';
import { UserUpdateRequest, UserSchema, type User } from '@repo/data-ops/zod-schema/user';

const UpdateUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
  data: UserUpdateRequest,
});

type UpdateUserInputType = z.infer<typeof UpdateUserInput>;

interface MutationSuccess {
  success: true;
  user: User;
}

interface MutationError {
  success: false;
  error: string;
  code: string;
}

export type MutationResult = MutationSuccess | MutationError;

/**
 * Update user - Direct data-ops mutation
 * Data Flow: Browser → Server Function → data-ops → Mock Store → Response
 */
export const updateUserDirect = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): UpdateUserInputType => UpdateUserInput.parse(data))
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
        return { success: false, error: 'Email already in use', code: 'EMAIL_EXISTS' };
      }
      return { success: false, error: 'Failed to update user', code: 'UNKNOWN' };
    }
  });
