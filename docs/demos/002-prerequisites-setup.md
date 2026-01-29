# Prerequisites Setup for Demo Routes

## Overview

This document describes the prerequisites required before implementing the demo routes. The setup uses **mocks from data-ops** that are designed to be easily replaced with a Neon database later.

## Architecture Decision: Mocks First

```
┌─────────────────────────────────────────────────────────────────┐
│                     Current (Mocks)                             │
│                                                                 │
│  data-ops/mocks/user-mock.ts                                   │
│  ├── MockUserStore class                                       │
│  ├── In-memory array storage                                   │
│  └── Same interface as future DB queries                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Easy migration
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Future (Neon Database)                      │
│                                                                 │
│  data-ops/queries/user.ts                                      │
│  ├── Drizzle ORM queries                                       │
│  ├── Neon serverless driver                                    │
│  └── Same interface as mocks                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Existing Mock Implementation

The mock is already implemented in `packages/data-ops/src/mocks/user-mock.ts`:

```typescript
// Already exists - no changes needed
class MockUserStore {
  private users: User[] = [/* 20 sample users */];
  
  getPaginated(params: PaginationQuery): UserListResponseData;
  findById(id: string): User | undefined;
  findByEmail(email: string): User | undefined;
  create(data: UserCreateInput): User;
  update(id: string, data: UserUpdateInput): User;
  delete(id: string): void;
}

export const mockUsers = new MockUserStore();
```

**Key Point:** The mock already follows the same interface we'll use with Neon. No mock changes needed.

## Prerequisites Checklist

### 1. Environment Variables

#### data-service (`.dev.vars`)

Create `apps/data-service/.dev.vars`:

```env
CLOUDFLARE_ENV=dev
API_TOKEN=demo-api-token-12345

# For staging/production CORS
# ALLOWED_ORIGINS=https://app.example.com
```

Update `apps/data-service/.example.vars`:

```env
CLOUDFLARE_ENV=dev
CLOUDFLARE_ENV_STAGING_ADDRESS=https://staging.YOUR_DOMAIN.COM
CLOUDFLARE_ENV_PRODUCTION_ADDRESS=https://YOUR_DOMAIN.COM

DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=

# API token for service-to-service auth
API_TOKEN=your-secure-token-here

# CORS: Comma-separated allowed origins (staging/production)
# ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
```

#### user-application (`.env.local`)

Create `apps/user-application/.env.local`:

```env
CLOUDFLARE_ENV=dev

# For client-side API calls (Pattern A)
VITE_DATA_SERVICE_URL=http://localhost:8787

# For service binding auth (Pattern B)
DATA_SERVICE_API_TOKEN=demo-api-token-12345

# Better Auth (existing)
BETTER_AUTH_SECRET=your-auth-secret
```

Update `apps/user-application/.env.example`:

```env
CLOUDFLARE_ENV=dev

# Database (for future Neon integration)
DATABASE_HOST=
DATABASE_USERNAME=
DATABASE_PASSWORD=

# Better Auth
BETTER_AUTH_SECRET=

# Data Service API (for client-side calls)
VITE_DATA_SERVICE_URL=http://localhost:8787

# Data Service API Token (for service binding)
DATA_SERVICE_API_TOKEN=
```

### 2. CORS Middleware (data-service)

See [003 - CORS Configuration](./003-cors-configuration.md) for full implementation.

**Summary:**
- Create `apps/data-service/src/hono/middleware/cors.ts`
- Apply middleware in `apps/data-service/src/hono/app.ts`
- Configure `ALLOWED_ORIGINS` for staging/production

### 3. Type Generation

Types are auto-generated from `.dev.vars` and `wrangler.jsonc` using Wrangler.

#### data-service Types

After adding variables to `.example.vars` / `.dev.vars`, regenerate types:

```bash
cd apps/data-service
pnpm run cf-typegen
```

This updates `worker-configuration.d.ts` with new variables in `Cloudflare.Env`.

**Note:** `service-bindings.d.ts` is for custom interfaces only (workflows, queues), not environment variables.

#### user-application Types

After adding variables to `.env.example` / `.env.local`, regenerate types:

```bash
cd apps/user-application
pnpm run cf-typegen
```

The service binding `DATA_SERVICE` is already defined in `wrangler.jsonc` and will be included in generated types.

### 4. Service Binding (Already Configured)

The service binding is already configured in `apps/user-application/wrangler.jsonc`:

```jsonc
{
  "env": {
    "dev": {
      "services": [
        {
          "binding": "DATA_SERVICE",
          "service": "saas-on-cf-ds-dev"
        }
      ]
    }
  }
}
```

No changes needed.

### 5. Demo Route Structure

Create the following route structure in user-application:

```
apps/user-application/src/routes/
├── demo/
│   ├── route.tsx              # Layout with navigation
│   ├── index.tsx              # Overview page
│   ├── users-list-api.tsx     # GET /users (client → API)
│   ├── user-detail-direct.tsx # GET /users/:id (server → mock)
│   ├── user-create-binding.tsx# POST /users (server → binding)
│   ├── user-update-direct.tsx # PUT /users (server → mock)
│   └── user-delete-direct.tsx # DELETE /users (server → mock)
```

## Implementation Order

### Phase 1: Core Setup (Prerequisites)

```
1. [ ] Create .dev.vars files with sample tokens
2. [ ] Implement CORS middleware in data-service
3. [ ] Update type definitions
4. [ ] Verify service binding works
```

### Phase 2: Demo Routes

```
5. [ ] Create /demo layout and index
6. [ ] Implement GET /users (client → API) - uses CORS
7. [ ] Implement GET /users/:id (server → mock)
8. [ ] Implement POST /users (server → binding)
9. [ ] Implement PUT /users (server → mock)
10. [ ] Implement DELETE /users (server → mock)
```

### Phase 3: Future Migration to Neon

```
11. [ ] Add Neon database connection to data-ops
12. [ ] Create Drizzle queries matching mock interface
13. [ ] Add D1/Neon binding to user-application
14. [ ] Switch imports from mocks to queries
```

## Mock vs Direct Query Pattern

### Using Mocks (Current - via data-service)

```typescript
// data-service/src/hono/services/user-service.ts
import { mockUsers } from '@repo/data-ops/mocks/user-mock';

export async function getUsers(params: PaginationQuery) {
  return mockUsers.getPaginated(params);
}
```

### Using Mocks (Current - via server function)

For server functions that bypass data-service, we can create a mock-based query interface:

```typescript
// data-ops/src/queries/user.ts (mock version)
import { mockUsers } from '../mocks/user-mock';
import type { User, PaginationQuery, UserListResponseData } from '../zod-schema/user';

// These functions mirror what we'll have with Neon
export async function getUser(userId: string): Promise<User | null> {
  return mockUsers.findById(userId) ?? null;
}

export async function getUsers(params: PaginationQuery): Promise<UserListResponseData> {
  return mockUsers.getPaginated(params);
}

export async function updateUser(userId: string, data: UserUpdateInput): Promise<User | null> {
  try {
    return mockUsers.update(userId, data);
  } catch {
    return null;
  }
}

export async function deleteUser(userId: string): Promise<boolean> {
  const user = mockUsers.findById(userId);
  if (!user) return false;
  mockUsers.delete(userId);
  return true;
}
```

### Future: Using Neon Database

```typescript
// data-ops/src/queries/user.ts (Neon version - future)
import { getDb } from '../database/setup';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export async function getUser(userId: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}

// Same interface, different implementation
```

## Token Configuration

### Sample Tokens for Development

| Token | Location | Value | Purpose |
|-------|----------|-------|---------|
| `API_TOKEN` | `data-service/.dev.vars` | `demo-api-token-12345` | Authenticate binding requests |
| `DATA_SERVICE_API_TOKEN` | `user-application/.env.local` | `demo-api-token-12345` | Same token for calling data-service |
| `BETTER_AUTH_SECRET` | `user-application/.env.local` | `dev-auth-secret-67890` | Better Auth session signing |

### Production Tokens

In production, use strong random tokens:

```bash
# Generate secure token
openssl rand -hex 32
```

Store in Cloudflare secrets:

```bash
# data-service
wrangler secret put API_TOKEN --env production

# user-application
wrangler secret put DATA_SERVICE_API_TOKEN --env production
```

## Verification Steps

### 1. Verify data-service starts

```bash
cd apps/data-service
pnpm dev
# Should start on http://localhost:8787
```

### 2. Verify CORS works

```bash
curl -X OPTIONS http://localhost:8787/users \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v 2>&1 | grep -i "access-control"
```

Expected:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### 3. Verify user-application starts

```bash
cd apps/user-application
pnpm dev
# Should start on http://localhost:5173
```

### 4. Verify service binding

```bash
# From user-application, test binding by visiting /demo routes
# Check browser console for successful API calls
```

## Related Documents

- [001 - Demo Overview](./001-demo-overview.md) - Architecture overview
- [003 - CORS Configuration](./003-cors-configuration.md) - CORS setup details
- [004 - GET Users (Client → API)](./004-get-users-client-api.md) - First demo to implement
