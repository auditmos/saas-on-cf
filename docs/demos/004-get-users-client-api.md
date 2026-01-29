# Demo: GET Users - Client → data-service (Direct API)

## Overview

This demo showcases **Pattern A**: the browser makes a direct HTTP request to the `data-service` public API endpoint. This pattern is ideal for public data that needs to be accessible by multiple clients (web, mobile, third-party).

## Data Flow Diagram

```
┌──────────────────┐
│     Browser      │
│  (React Client)  │
└────────┬─────────┘
         │
         │ 1. fetch('https://api.example.com/users')
         │    Headers: { Authorization: Bearer <token> }
         │
         ▼
┌──────────────────┐
│   data-service   │
│   (Hono API)     │
│                  │
│  CORS Middleware │◄── Validates origin
│  Rate Limiting   │◄── Prevents abuse
│  Zod Validation  │◄── Validates query params
└────────┬─────────┘
         │
         │ 2. Calls user-service
         │
         ▼
┌──────────────────┐
│    data-ops      │
│  (mockUsers)     │
└────────┬─────────┘
         │
         │ 3. Returns paginated users
         │
         ▼
┌──────────────────┐
│     Browser      │
│  TanStack Query  │
│  caches response │
└──────────────────┘
```

## When to Use This Pattern

**Good fit:**
- Public data (product listings, public profiles)
- Mobile app needs same API
- Real-time features (WebSocket/SSE from data-service)
- You want user-application to be purely UI
- SPAs with minimal SSR needs

**Avoid when:**
- Data requires server-side auth session
- SSR is important for SEO
- Operations need server-only secrets
- Complex validation that shouldn't be in client

## Pros and Cons

| Pros | Cons |
|------|------|
| Simple client-side implementation | No SSR support (client-only) |
| Reusable by mobile apps | Requires public endpoint |
| Same API for all clients | CORS configuration needed |
| No server function overhead | Client must manage auth tokens |
| Easy to cache at CDN level | Exposes API structure to clients |
| Can use browser caching | Network errors visible to user |

## Prerequisites

### 1. CORS Middleware in data-service

Add to `apps/data-service/src/hono/middleware/cors.ts`:

```typescript
import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://your-app.com',
    ];
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400,
});
```

Update `apps/data-service/src/hono/app.ts`:

```typescript
import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import health from "./handlers/health-handlers";
import users from "./handlers/user-handlers";
import { errorHandler, onErrorHandler } from "./middleware/error-handler";

export const App = new Hono<{ Bindings: Env }>();

App.onError(onErrorHandler);
App.use('*', errorHandler());
App.use('*', corsMiddleware);  // Add CORS middleware

App.route('/health', health);
App.route('/users', users);
```

### 2. Environment Variable for API URL

Add to `apps/user-application/.env`:

```env
VITE_DATA_SERVICE_URL=http://localhost:8787
```

## Implementation Steps

### Step 1: Create API Client Utility

```typescript
// apps/user-application/src/lib/api-client.ts
import type { UserListResponseData, PaginationQuery } from '@repo/data-ops/zod-schema/user';

const API_URL = import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8787';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchUsers(params: PaginationQuery): Promise<UserListResponseData> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit ?? 10),
    offset: String(params.offset ?? 0),
  });

  const response = await fetch(`${API_URL}/users?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message || 'Failed to fetch users',
      response.status,
      error.code
    );
  }

  return response.json();
}
```

### Step 2: Create Query Keys Factory

```typescript
// apps/user-application/src/lib/query-keys.ts
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: { limit: number; offset: number }) =>
    [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};
```

### Step 3: Create Demo Route Layout

```tsx
// apps/user-application/src/routes/demo/route.tsx
import { createFileRoute, Outlet, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/demo')({
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Data Flow Demos</h1>
          <nav className="mt-4 flex gap-4 flex-wrap">
            <Link
              to="/demo/users-list-api"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              GET Users (Client→API)
            </Link>
            <Link
              to="/demo/user-detail-direct"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              GET User (Server→data-ops)
            </Link>
            <Link
              to="/demo/user-create-binding"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              POST User (Server→Binding)
            </Link>
            <Link
              to="/demo/user-update-direct"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              PUT User (Server→data-ops)
            </Link>
            <Link
              to="/demo/user-delete-direct"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              DELETE User (Server→data-ops)
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

### Step 4: Create Demo Index Page

```tsx
// apps/user-application/src/routes/demo/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const Route = createFileRoute('/demo/')({
  component: DemoIndexPage,
});

function DemoIndexPage() {
  const demos = [
    {
      title: 'GET Users - Client → API',
      description: 'Browser fetches directly from data-service public endpoint',
      href: '/demo/users-list-api',
      pattern: 'Pattern A',
      ssr: false,
    },
    {
      title: 'GET User - Server → data-ops',
      description: 'Server function queries database directly via data-ops',
      href: '/demo/user-detail-direct',
      pattern: 'Pattern C',
      ssr: true,
    },
    {
      title: 'POST User - Server → Binding',
      description: 'Server function calls data-service via service binding',
      href: '/demo/user-create-binding',
      pattern: 'Pattern B',
      ssr: true,
    },
    {
      title: 'PUT User - Server → data-ops',
      description: 'Server function updates database directly via data-ops',
      href: '/demo/user-update-direct',
      pattern: 'Pattern C',
      ssr: true,
    },
    {
      title: 'DELETE User - Server → data-ops',
      description: 'Server function deletes from database via data-ops',
      href: '/demo/user-delete-direct',
      pattern: 'Pattern C',
      ssr: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose a Demo</h2>
        <p className="text-muted-foreground mt-1">
          Each demo showcases a different data flow pattern
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {demos.map((demo) => (
          <Link key={demo.href} to={demo.href}>
            <Card className="h-full hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-muted px-2 py-1 rounded">
                    {demo.pattern}
                  </span>
                  <span className={`text-xs ${demo.ssr ? 'text-green-600' : 'text-orange-600'}`}>
                    {demo.ssr ? 'SSR ✓' : 'Client Only'}
                  </span>
                </div>
                <CardTitle className="text-lg mt-2">{demo.title}</CardTitle>
                <CardDescription>{demo.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### Step 5: Create GET Users Demo Page

```tsx
// apps/user-application/src/routes/demo/users-list-api.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchUsers, ApiError } from '@/lib/api-client';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/users-list-api')({
  component: UsersListApiDemo,
});

function UsersListApiDemo() {
  const [pagination, setPagination] = useState({ limit: 5, offset: 0 });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: userKeys.list(pagination),
    queryFn: () => fetchUsers(pagination),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">GET Users - Client → data-service</h2>
        <p className="text-muted-foreground mt-1">
          Direct browser fetch to data-service public API endpoint
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
    │ 1. useQuery calls fetchUsers()
    │
    ▼
fetch('${import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8787'}/users?limit=5&offset=0')
    │
    │ 2. HTTP GET request (crosses network)
    │
    ▼
data-service (Hono)
    │
    │ 3. CORS check → Zod validation → user-service
    │
    ▼
Response JSON → TanStack Query cache → UI`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Simple client-side implementation</li>
                <li>Reusable by mobile apps</li>
                <li>No server function overhead</li>
                <li>CDN cacheable</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>No SSR support</li>
                <li>Requires CORS configuration</li>
                <li>Client manages auth tokens</li>
                <li>API structure exposed</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for public data, mobile app compatibility, real-time features,
              and when you want user-application to be purely UI.
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
          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof ApiError
                  ? `${error.message} (Status: ${error.status})`
                  : 'Failed to fetch users. Is data-service running?'}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading users...</span>
            </div>
          )}

          {/* Data */}
          {data && (
            <>
              <div className="border rounded">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((user) => (
                      <tr key={user.id} className="border-t">
                        <td className="p-2 font-mono text-sm">{user.id}</td>
                        <td className="p-2">{user.name}</td>
                        <td className="p-2">{user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1} - {pagination.offset + data.data.length} of {data.pagination.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.offset === 0}
                    onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasMore}
                    onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Refetch Button */}
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refetching...' : 'Refetch'}
          </Button>
        </CardContent>
      </Card>

      {/* Code Example */}
      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// API Client
export async function fetchUsers(params: PaginationQuery) {
  const response = await fetch(\`\${API_URL}/users?\${searchParams}\`);
  if (!response.ok) throw new ApiError(...);
  return response.json();
}

// Component with TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: userKeys.list(pagination),
  queryFn: () => fetchUsers(pagination),
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Testing

1. **Start data-service:**
   ```bash
   cd apps/data-service && pnpm dev
   ```

2. **Start user-application:**
   ```bash
   cd apps/user-application && pnpm dev
   ```

3. **Navigate to demo:**
   Open `http://localhost:5173/demo/users-list-api`

4. **Verify CORS:**
   - Check browser Network tab for preflight OPTIONS request
   - Ensure `Access-Control-Allow-Origin` header is present

5. **Test error handling:**
   - Stop data-service and observe error state
   - Restart and verify refetch works

## Related Patterns

- [005 - GET User (Server → data-ops)](./005-get-user-direct-dataops.md) - Alternative using server function
- [006 - POST User (Server → Binding)](./006-post-user-service-binding.md) - Write operation via binding
