import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  UserCreateRequestSchema,
  UserUpdateRequestSchema,
  PaginationRequestSchema,
  IdParamSchema
} from '@repo/data-ops/zod-schema/user';
import { authMiddleware } from '../middleware/auth';
import * as userService from '../services/user-service';

const users = new Hono<{ Bindings: Env }>();

users.get('/', zValidator('query', PaginationRequestSchema), async (c) => {
  const query = c.req.valid('query');
  return c.json(await userService.getUsers(query));
});

users.get('/:id', zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  return c.json(await userService.getUserById(id));
});

users.post(
  '/',
  (c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
  zValidator('json', UserCreateRequestSchema),
  async (c) => {
    const data = c.req.valid('json');
    return c.json(await userService.createUser(data), 201);
  }
);

users.put(
  '/:id',
  (c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
  zValidator('param', IdParamSchema),
  zValidator('json', UserUpdateRequestSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    return c.json(await userService.updateUser(id, data));
  }
);

users.delete(
  '/:id',
  (c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
  zValidator('param', IdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    await userService.deleteUser(id);
    return c.body(null, 204);
  }
);

export default users;
