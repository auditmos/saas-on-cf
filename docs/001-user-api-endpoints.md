# User API Endpoints Design

## Overview

REST API endpoints for user CRUD operations in data-service app. Uses mocked data from data-ops package with schema validation.

## Goals

- CRUD endpoints for users
- Request/response validation via Zod schemas
- Bearer token auth for mutating endpoints (POST/PUT/DELETE)
- Simple rate limiting middleware
- Follow existing Hono patterns (handlers, services)
- Mock data strategy (no active DB)

## API Endpoints

### GET /users
List users with pagination

**Query Params**:
- `limit` (optional): max items, default 10, max 100
- `offset` (optional): skip items, default 0

**Response**: 200
```typescript
{
  data: UserSchema[],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean
  }
}
```

### GET /users/:id
Get single user by ID

**Response**: 200
```typescript
UserSchema
```

**Errors**:
- 404: User not found

### POST /users 🔒
Create new user

**Headers**: `Authorization: Bearer <token>`

**Request**:
```typescript
{
  name: string,
  email: string
}
```

**Response**: 201
```typescript
UserSchema
```

**Errors**:
- 400: Validation failed
- 401: Unauthorized
- 409: Email already exists

### PUT /users/:id 🔒
Update existing user

**Headers**: `Authorization: Bearer <token>`

**Request**:
```typescript
{
  name?: string,
  email?: string
}
```

**Response**: 200
```typescript
UserSchema
```

**Errors**:
- 400: Validation failed
- 401: Unauthorized
- 404: User not found
- 409: Email already exists

### DELETE /users/:id 🔒
Delete user

**Headers**: `Authorization: Bearer <token>`

**Response**: 204 (no content)

**Errors**:
- 401: Unauthorized
- 404: User not found

## Request/Response Schemas

Located in `packages/data-ops/src/zod-schema/user.ts`:

```typescript
// Domain schema (DB model)
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
});

// Request schemas
export const UserCreateRequest = z.object({
  name: z.string().min(1).max(30),
  email: z.string().email()
});

export const UserUpdateRequest = z.object({
  name: z.string().min(1).max(30).optional(),
  email: z.string().email().optional()
}).refine(data => data.name || data.email, {
  message: "At least one field required"
});

// Query schemas
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0)
});

// Response schemas
export const PaginationMetaSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean()
});

export const UserResponse = UserSchema;

export const UserListResponse = z.object({
  data: z.array(UserSchema),
  pagination: PaginationMetaSchema
});

// Types
export type User = z.infer<typeof UserSchema>;
export type UserCreateInput = z.infer<typeof UserCreateRequest>;
export type UserUpdateInput = z.infer<typeof UserUpdateRequest>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type UserListResponseData = z.infer<typeof UserListResponse>;
```

## File Structure

```
apps/data-service/src/hono/
├── app.ts                           # Add route: App.route('/users', users)
├── handlers/
│   ├── health-handlers.ts          # Existing
│   └── user-handlers.ts            # New: Route definitions with validation
├── services/
│   └── user-service.ts             # New: Business logic, calls data-ops
└── middleware/
    ├── error-handler.ts            # Existing (reuse)
    ├── auth.ts                     # New: Bearer token middleware
    └── rate-limiter.ts             # New: Simple rate limiting

packages/data-ops/src/
├── zod-schema/
│   └── user.ts                     # Schemas + types
├── mocks/
│   └── user-mock.ts                # Mock store (new)
└── index.ts                        # Export mocks
```

## Implementation Details

### Auth Middleware (`middleware/auth.ts`)

Uses Hono's `bearerAuth`. Token validated against env var.

```typescript
import { bearerAuth } from 'hono/bearer-auth';

export const authMiddleware = (token: string) => bearerAuth({ token });
```

### Rate Limiter Middleware (`middleware/rate-limiter.ts`)

Simple sliding window rate limiter. In-memory store, resets on worker restart.

```typescript
import type { MiddlewareHandler } from 'hono';

interface RateLimitConfig {
  windowMs: number;    // time window in ms
  maxRequests: number; // max requests per window
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (config: RateLimitConfig): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + config.windowMs });
      return next();
    }

    if (record.count >= config.maxRequests) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    record.count++;
    return next();
  };
};
```

### Usage Example (`health-handlers.ts`)

```typescript
import { Hono } from 'hono';
import { rateLimiter } from '../middleware/rate-limiter';

const health = new Hono<{ Bindings: Env }>();

health.use('*', rateLimiter({ windowMs: 1000, maxRequests: 10 })); // 10 req/sec

health.get('/', (c) => c.json({ status: 'ok' }));

export default health;
```

### Handler Pattern (`user-handlers.ts`)

```typescript
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
```

### Service Layer (`user-service.ts`)

Service uses mock data from data-ops.

```typescript
import type {
  User,
  UserCreateInput,
  UserUpdateInput,
  PaginationQuery,
  UserListResponseData
} from '@repo/data-ops/zod-schema/user';
import { mockUsers } from '@repo/data-ops/mocks/user-mock';
import { HTTPException } from 'hono/http-exception';

export async function getUsers(params: PaginationQuery): Promise<UserListResponseData> {
  return mockUsers.getPaginated(params);
}

export async function getUserById(id: string): Promise<User> {
  const user = mockUsers.findById(id);
  if (!user) throw new HTTPException(404, { message: 'User not found' });
  return user;
}

export async function createUser(data: UserCreateInput): Promise<User> {
  if (mockUsers.findByEmail(data.email)) {
    throw new HTTPException(409, { message: 'Email already exists' });
  }
  return mockUsers.create(data);
}

export async function updateUser(id: string, data: UserUpdateInput): Promise<User> {
  const existing = mockUsers.findById(id);
  if (!existing) throw new HTTPException(404, { message: 'User not found' });

  if (data.email && data.email !== existing.email && mockUsers.findByEmail(data.email)) {
    throw new HTTPException(409, { message: 'Email already exists' });
  }

  return mockUsers.update(id, data);
}

export async function deleteUser(id: string): Promise<void> {
  if (!mockUsers.findById(id)) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  mockUsers.delete(id);
}
```

## Mock Data Strategy

Create `packages/data-ops/src/mocks/user-mock.ts`:

```typescript
import type {
  User,
  UserCreateInput,
  UserUpdateInput,
  PaginationQuery,
  UserListResponseData
} from '../zod-schema/user';

class MockUserStore {
  private users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com' },
    { id: '4', name: 'Diana', email: 'diana@example.com' },
    { id: '5', name: 'Eve', email: 'eve@example.com' },
    { id: '6', name: 'Frank', email: 'frank@example.com' },
    { id: '7', name: 'Grace', email: 'grace@example.com' },
    { id: '8', name: 'Henry', email: 'henry@example.com' },
    { id: '9', name: 'Ivy', email: 'ivy@example.com' },
    { id: '10', name: 'Jack', email: 'jack@example.com' },
    { id: '11', name: 'Kate', email: 'kate@example.com' },
    { id: '12', name: 'Leo', email: 'leo@example.com' },
    { id: '13', name: 'Mia', email: 'mia@example.com' },
    { id: '14', name: 'Noah', email: 'noah@example.com' },
    { id: '15', name: 'Olivia', email: 'olivia@example.com' },
    { id: '16', name: 'Paul', email: 'paul@example.com' },
    { id: '17', name: 'Quinn', email: 'quinn@example.com' },
    { id: '18', name: 'Ryan', email: 'ryan@example.com' },
    { id: '19', name: 'Sara', email: 'sara@example.com' },
    { id: '20', name: 'Tom', email: 'tom@example.com' }
  ];
  private nextId = 21;

  getPaginated({ limit, offset }: PaginationQuery): UserListResponseData {
    const total = this.users.length;
    const data = this.users.slice(offset, offset + limit);
    return {
      data,
      pagination: { total, limit, offset, hasMore: offset + limit < total }
    };
  }

  findById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  findByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }

  create(data: UserCreateInput): User {
    const user: User = { id: String(this.nextId++), ...data };
    this.users.push(user);
    return user;
  }

  update(id: string, data: UserUpdateInput): User {
    const index = this.users.findIndex(u => u.id === id);
    const updated = { ...this.users[index], ...data };
    this.users[index] = updated;
    return updated;
  }

  delete(id: string): void {
    this.users = this.users.filter(u => u.id !== id);
  }
}

export const mockUsers = new MockUserStore();
```

Update `packages/data-ops/src/index.ts`:

```typescript
export * from './mocks/user-mock';
```

## Migration Path to Real DB

When ready to use actual DB:

1. Create `packages/data-ops/src/queries/user.ts` w/ real DB calls
2. Update service imports from `mocks/user-mock` → `queries/user`
3. Remove mock store from data-ops
4. No handler changes needed (service interface stays same)

Benefit: Mock lives in data-ops, same location as future queries → cleaner migration

## Dependencies

Add to `apps/data-service/package.json`:

```json
{
  "dependencies": {
    "@hono/zod-validator": "^0.x.x"
  }
}
```

## Environment Variables

Add to `.dev.vars`:

```
API_TOKEN=your-secret-token
```

Run `pnpm run cf-typegen` to generate types.

## Validation Rules Summary

POST `/users` validations:
- `name`: min 1 char, max 30 chars
- `email`: valid email format

PUT `/users/:id` validations:
- `name`: min 1 char, max 30 chars (if provided)
- `email`: valid email format (if provided)
- At least one field required
