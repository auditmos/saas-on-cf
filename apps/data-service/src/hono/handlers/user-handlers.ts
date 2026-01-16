import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  UserCreateRequest,
  UserUpdateRequest,
  PaginationQuerySchema
} from '@repo/data-ops/zod-schema/user';
import { authMiddleware } from '../middleware/auth';
import * as userService from '../services/user-service';

const users = new Hono<{ Bindings: Env }>();

users.get('/', zValidator('query', PaginationQuerySchema), async (c) => {
  const query = c.req.valid('query');
  return c.json(await userService.getUsers(query));
});

users.get('/:id', async (c) => {
  return c.json(await userService.getUserById(c.req.param('id')));
});

users.post(
  '/',
  (c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
  zValidator('json', UserCreateRequest),
  async (c) => {
    const data = c.req.valid('json');
    return c.json(await userService.createUser(data), 201);
  }
);

users.put(
  '/:id',
  (c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
  zValidator('json', UserUpdateRequest),
  async (c) => {
    const data = c.req.valid('json');
    return c.json(await userService.updateUser(c.req.param('id'), data));
  }
);

users.delete(
  '/:id',
  (c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
  async (c) => {
    await userService.deleteUser(c.req.param('id'));
    return c.body(null, 204);
  }
);

export default users;
