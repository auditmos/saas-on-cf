import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import {
  UserCreateRequest,
  UserSchema,
  type UserCreateInput,
  type User,
} from '@repo/data-ops/zod-schema/user';

export type CreateUserResponse =
  | { success: true; user: User }
  | { success: false; error: string; field?: keyof UserCreateInput };

export const handleCreateUserViaBinding = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): UserCreateInput => {
    if (data instanceof FormData) {
      const parsed = UserCreateRequest.safeParse({
        name: data.get('name'),
        email: data.get('email'),
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Validation failed');
      }
      return parsed.data;
    }
    const parsed = UserCreateRequest.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Validation failed');
    }
    return parsed.data;
  })
  .handler(async (ctx): Promise<CreateUserResponse> => {
    const validatedData = ctx.data;

    if (validatedData.email.endsWith('@blocked.com')) {
      return {
        success: false,
        error: 'This email domain is not allowed',
        field: 'email',
      };
    }

    const response = await env.DATA_SERVICE.fetch(
      new Request('https://data-service/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
        },
        body: JSON.stringify(validatedData),
      })
    );

    if (!response.ok) {
      const errorBody = (await response.json()) as { message?: string };
      return { success: false, error: errorBody.message || 'Failed to create user' };
    }

    const user = UserSchema.parse(await response.json());
    return { success: true, user };
  });
