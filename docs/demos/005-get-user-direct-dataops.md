# Demo: GET User - Server Function → data-ops (Direct Query)

## Overview

This demo showcases **Pattern C**: a server function directly imports and calls queries from `data-ops`, bypassing `data-service` entirely. This pattern offers the lowest latency and full SSR support.

**Note:** Currently uses mocks that mirror the future Neon database interface. When migrating to Neon, only the internal implementation changes - the interface stays the same.

## Data Flow Diagram

```
┌──────────────────┐
│     Browser      │
│  (React Client)  │
└────────┬─────────┘
         │
         │ 1. Route loader / useQuery
         │    calls server function
         │
         ▼
┌──────────────────────────────────┐
│      user-application            │
│      (Server Function)           │
│                                  │
│  • Auth middleware (session)     │
│  • Input validation (Zod)        │
│  • Direct import from data-ops   │
└────────┬─────────────────────────┘
         │
         │ 2. Direct function call
         │    (no network hop)
         │
         ▼
┌──────────────────┐
│    data-ops      │
│  queries/user.ts │
│                  │
│  getUser(id)     │
└────────┬─────────┘
         │
         │ 3. SQL query
         │
         ▼
┌──────────────────┐
│   D1 Database    │
└────────┬─────────┘
         │
         │ 4. Returns user data
         │
         ▼
┌──────────────────┐
│     Browser      │
│  (SSR or Client) │
└──────────────────┘
```

## When to Use This Pattern

**Good fit:**
- Performance-critical reads
- App-specific queries (not needed by other clients)
- Complex queries with joins
- Queries that benefit from SSR
- Auth/session operations
- Dashboard aggregations

**Avoid when:**
- Same query needed by mobile app / external clients
- Business logic should be centralized in data-service
- Query needs data-service rate limiting/caching

## Pros and Cons

| Pros | Cons |
|------|------|
| Lowest latency (no extra hop) | Logic not shared with data-service |
| Full SSR support | Requires D1 binding in user-application |
| Direct transaction control | Tighter coupling to database |
| Can use Drizzle ORM features | More complex deployment config |
| No API serialization overhead | Business logic may diverge |
| Server session auth (simpler) | Testing requires DB setup |

## Prerequisites

### 1. Mock-Based Query Interface

Create `packages/data-ops/src/queries/user.ts` (uses mocks internally):

```typescript
import { mockUsers } from '../mocks/user-mock';
import type { 
  User, 
  PaginationQuery, 
  UserListResponseData,
  UserUpdateInput 
} from '../zod-schema/user';

/**
 * Get user by ID
 * Currently uses mock, will use Neon database later
 */
export async function getUser(userId: string): Promise<User | null> {
  return mockUsers.findById(userId) ?? null;
}

/**
 * Get paginated users
 */
export async function getUsers(params: PaginationQuery): Promise<UserListResponseData> {
  return mockUsers.getPaginated(params);
}

/**
 * Update user
 */
export async function updateUser(
  userId: string, 
  data: UserUpdateInput
): Promise<User | null> {
  const existing = mockUsers.findById(userId);
  if (!existing) return null;
  
  // Check email uniqueness
  if (data.email && data.email !== existing.email) {
    const emailExists = mockUsers.findByEmail(data.email);
    if (emailExists) throw new Error('EMAIL_EXISTS');
  }
  
  return mockUsers.update(userId, data);
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const user = mockUsers.findById(userId);
  if (!user) return false;
  mockUsers.delete(userId);
  return true;
}
```

### 2. Export from Package

Add to `packages/data-ops/package.json` exports:

```json
{
  "exports": {
    "./queries/user": "./src/queries/user.ts",
    "./mocks/user-mock": "./src/mocks/user-mock.ts",
    "./zod-schema/user": "./src/zod-schema/user.ts"
  }
}
```

### 3. Future Migration to Neon

When ready to use Neon, replace the mock implementation:

```typescript
// Future: packages/data-ops/src/queries/user.ts
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

## Implementation Steps

### Step 1: Create Server Function

```typescript
// apps/user-application/src/core/functions/user-queries.ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getUser } from '@repo/data-ops/queries/user';
import { UserSchema, type User } from '@repo/data-ops/zod-schema/user';

// Input schema for get user
const GetUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
});

type GetUserInputType = z.infer<typeof GetUserInput>;

/**
 * Get user by ID - Direct data-ops query
 * 
 * Data Flow: Browser → Server Function → data-ops → D1 → Response
 * 
 * Benefits:
 * - Lowest latency (single hop)
 * - SSR compatible
 * - Direct transaction control
 */
export const getUserDirect = createServerFn({ method: 'GET' })
  .validator((data: unknown): GetUserInputType => {
    return GetUserInput.parse(data);
  })
  .handler(async ({ data }): Promise<User | null> => {
    const { id } = data;
    
    // Direct call to data-ops query
    const user = await getUser(id);
    
    if (!user) {
      return null;
    }
    
    // Validate output matches expected schema
    return UserSchema.parse(user);
  });
```

### Step 2: Create Demo Route with SSR

```tsx
// apps/user-application/src/routes/demo/user-detail-direct.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getUserDirect } from '@/core/functions/user-queries';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/user-detail-direct')({
  component: UserDetailDirectDemo,
  // SSR: Load data on server for initial render
  loader: async () => {
    // Default user ID for demo purposes
    const defaultUserId = '1';
    try {
      const user = await getUserDirect({ data: { id: defaultUserId } });
      return { initialUser: user, initialUserId: defaultUserId };
    } catch {
      return { initialUser: null, initialUserId: defaultUserId };
    }
  },
});

function UserDetailDirectDemo() {
  const { initialUser, initialUserId } = Route.useLoaderData();
  const [userId, setUserId] = useState(initialUserId);
  const [searchId, setSearchId] = useState(initialUserId);

  const { data: user, isLoading, error, isFetching } = useQuery({
    queryKey: userKeys.detail(searchId),
    queryFn: () => getUserDirect({ data: { id: searchId } }),
    initialData: searchId === initialUserId ? initialUser : undefined,
  });

  const handleSearch = () => {
    setSearchId(userId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">GET User - Server → data-ops</h2>
        <p className="text-muted-foreground mt-1">
          Server function directly queries database via data-ops package
        </p>
      </div>

      {/* Data Flow Description */}
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (React)
    │
    │ 1. Route loader (SSR) or useQuery (client)
    │    calls getUserDirect({ data: { id } })
    │
    ▼
Server Function (user-application)
    │
    │ 2. Zod validation
    │
    ▼
import { getUser } from '@repo/data-ops/queries/user'
    │
    │ 3. Direct function call (no network)
    │
    ▼
data-ops: getUser(id)
    │
    │ 4. Drizzle ORM → SQL query
    │
    ▼
D1 Database → User data → Response`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Lowest latency (no extra hop)</li>
                <li>Full SSR support</li>
                <li>Direct transaction control</li>
                <li>No API serialization overhead</li>
                <li>Server session auth</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Logic not shared with data-service</li>
                <li>Requires D1 binding</li>
                <li>Tighter coupling to database</li>
                <li>Testing needs DB setup</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for performance-critical reads, app-specific queries, complex joins,
              dashboard aggregations, and auth/session operations.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-950 p-4 rounded">
            <h4 className="font-semibold">SSR Advantage</h4>
            <p className="text-sm mt-1">
              This page uses route loader for SSR. The initial user data was loaded 
              on the server before the page rendered, providing instant display 
              without loading states on first visit.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Form */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter user ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isFetching}>
              {isFetching ? 'Loading...' : 'Search'}
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Failed to fetch user'}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading user...</span>
            </div>
          )}

          {/* User Data */}
          {user && (
            <div className="border rounded p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{user.id}</span>
                <span className="text-muted-foreground">Name:</span>
                <span>{user.name}</span>
                <span className="text-muted-foreground">Email:</span>
                <span>{user.email}</span>
              </div>
            </div>
          )}

          {/* Not Found State */}
          {!isLoading && !error && !user && (
            <Alert>
              <AlertTitle>Not Found</AlertTitle>
              <AlertDescription>
                No user found with ID: {searchId}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Code Example */}
      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// Server Function (direct data-ops import)
import { getUser } from '@repo/data-ops/queries/user';

export const getUserDirect = createServerFn({ method: 'GET' })
  .validator((data) => GetUserInput.parse(data))
  .handler(async ({ data }) => {
    // Direct call - no network hop!
    const user = await getUser(data.id);
    return user ? UserSchema.parse(user) : null;
  });

// Route with SSR loader
export const Route = createFileRoute('/demo/user-detail-direct')({
  loader: async () => {
    const user = await getUserDirect({ data: { id: '1' } });
    return { initialUser: user };
  },
  component: UserDetailDirectDemo,
});

// Component with hydration
const { initialUser } = Route.useLoaderData();
const { data } = useQuery({
  queryKey: userKeys.detail(id),
  queryFn: () => getUserDirect({ data: { id } }),
  initialData: initialUser,  // Hydrate from SSR
});`}
          </pre>
        </CardContent>
      </Card>

      {/* Comparison with Other Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Aspect</th>
                <th className="text-left p-2">This Pattern</th>
                <th className="text-left p-2">Via data-service</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">Network hops</td>
                <td className="p-2 text-green-600">1 (browser → server)</td>
                <td className="p-2 text-orange-600">2 (browser → server → API)</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">SSR</td>
                <td className="p-2 text-green-600">✓ Supported</td>
                <td className="p-2 text-green-600">✓ Supported</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Logic reuse</td>
                <td className="p-2 text-orange-600">App-specific</td>
                <td className="p-2 text-green-600">Shared with API</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Rate limiting</td>
                <td className="p-2 text-orange-600">Must implement</td>
                <td className="p-2 text-green-600">API handles it</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 3: Add Missing Query (if needed)

If you need paginated users, add to `packages/data-ops/src/queries/user.ts`:

```typescript
import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { eq, count } from "drizzle-orm";
import type { PaginationQuery, UserListResponseData } from "@/zod-schema/user";

export async function getUser(userId: string) {
  const db = getDb();
  const [user] = await db
    .select({
      id: auth_user.id,
      name: auth_user.name,
      email: auth_user.email
    })
    .from(auth_user)
    .where(eq(auth_user.id, userId));
  return user;
}

export async function getUsers(params: PaginationQuery): Promise<UserListResponseData> {
  const db = getDb();
  const { limit = 10, offset = 0 } = params;

  const [users, [{ total }]] = await Promise.all([
    db
      .select({
        id: auth_user.id,
        name: auth_user.name,
        email: auth_user.email
      })
      .from(auth_user)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(auth_user),
  ]);

  return {
    data: users,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + users.length < total,
    },
  };
}
```

## Testing

1. **Verify D1 binding:**
   ```bash
   cd apps/user-application && wrangler d1 list
   ```

2. **Start user-application:**
   ```bash
   cd apps/user-application && pnpm dev
   ```

3. **Test SSR:**
   - Open `http://localhost:5173/demo/user-detail-direct`
   - View page source - user data should be in HTML

4. **Test client-side fetch:**
   - Enter a different user ID
   - Click Search
   - Observe network tab - request goes to `/_server` endpoint

5. **Compare with client API pattern:**
   - Open Network tab
   - This pattern: single request to server function
   - Client API pattern: direct request to data-service

## Related Patterns

- [004 - GET Users (Client → API)](./004-get-users-client-api.md) - Alternative without SSR
- [007 - PUT User (Server → data-ops)](./007-put-user-direct-dataops.md) - Same pattern for mutations
- [008 - DELETE User (Server → data-ops)](./008-delete-user-direct-dataops.md) - Same pattern for deletes
