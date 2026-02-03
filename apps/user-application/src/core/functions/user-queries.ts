import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { UserSchema, type User } from '@repo/data-ops/zod-schema/user';

const GetUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
});

type GetUserInputType = z.infer<typeof GetUserInput>;

/**
 * Get user by ID via data-service binding
 * Data Flow: Browser → Server Function → data-service → Response
 */
export const getUserDirect = createServerFn()
  .inputValidator((data: GetUserInputType) => GetUserInput.parse(data))
  .handler(async (ctx): Promise<User | null> => {
    const { id } = ctx.data;

    const response = await env.DATA_SERVICE.fetch(
      new Request(`https://data-service/users/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
        },
      })
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return UserSchema.parse(await response.json());
  });
