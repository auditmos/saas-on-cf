import { bearerAuth } from 'hono/bearer-auth';

export const authMiddleware = (token: string) => bearerAuth({ token });
