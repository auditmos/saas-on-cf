import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getUserDirect } from '@/core/functions/user-queries';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const userDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: () => getUserDirect({ data: { id } }),
    staleTime: 1000 * 60, // 1 min - prevents immediate refetch after SSR
  });

export const Route = createFileRoute('/demo/user-detail-direct')({
  component: UserDetailDirectDemo,
  loader: async ({ context }) => {
    const defaultUserId = '1';
    // Prefetch into React Query cache
    await context.queryClient.ensureQueryData(userDetailQueryOptions(defaultUserId));
    return { initialUserId: defaultUserId };
  },
});

function UserDetailDirectDemo() {
  const { initialUserId } = Route.useLoaderData();
  const [userId, setUserId] = useState(initialUserId);
  const [searchId, setSearchId] = useState(initialUserId);

  const { data: user, isLoading, error, isFetching } = useQuery({
    ...userDetailQueryOptions(searchId),
    placeholderData: (prev) => prev, // Keep old data while fetching new
  });

  const handleSearch = () => {
    setSearchId(userId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">GET User - Server → data-service (Binding)</h2>
        <p className="text-muted-foreground mt-1">
          Server function queries data-service via Cloudflare service binding
        </p>
      </div>

      {/* Data Flow Description */}
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser Navigation
    │
    │ 1. Route loader runs (SSR)
    │    queryClient.ensureQueryData(...)
    │
    ▼
Server Function (getUserDirect)
    │
    │ 2. Zod validation
    │
    ▼
env.DATA_SERVICE.fetch('/users/{id}')
    │
    │ 3. Internal network (service binding)
    │
    ▼
data-service (Hono API)
    │
    │ 4. Result cached in React Query
    │
    ▼
Component Renders (no refetch flash)`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Full SSR support</li>
                <li>Internal network (no CORS)</li>
                <li>Shared data with other demos</li>
                <li>Server-side auth token</li>
                <li>Centralized business logic</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Extra hop latency</li>
                <li>Depends on data-service</li>
                <li>API token management</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for SSR with shared data source, when data-service has the
              endpoint, and when you need consistent data across all demos.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-950 p-4 rounded">
            <h4 className="font-semibold">SSR + Service Binding</h4>
            <p className="text-sm mt-1">
              Route loader prefetches via service binding (internal network).
              Data cached in React Query for instant client render.
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
{`// Query options factory (best practice)
const userDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: () => getUserDirect({ data: { id } }),
    staleTime: 1000 * 60, // prevents refetch flash
  });

// Route with SSR prefetch into React Query cache
export const Route = createFileRoute('/demo/user-detail-direct')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      userDetailQueryOptions('1')
    );
    return { initialUserId: '1' };
  },
  component: UserDetailDirectDemo,
});

// Component - data already in cache from loader
const { data } = useQuery({
  ...userDetailQueryOptions(searchId),
  placeholderData: (prev) => prev, // smooth transitions
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
