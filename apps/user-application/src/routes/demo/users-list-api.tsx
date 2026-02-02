import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { usersListQueryOptions } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/users-list-api')({
  component: UsersListApiDemo,
});

function UsersListApiDemo() {
  const [pagination, setPagination] = useState({ limit: 5, offset: 0 });

  const { data, isLoading, error, refetch, isFetching } = useQuery(
    usersListQueryOptions(pagination)
  );

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
fetch('${import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8788'}/users?limit=5&offset=0')
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
{`// Query Options (lib/query-keys.ts)
export const usersListQueryOptions = (params) =>
  queryOptions({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsers(params),
    placeholderData: (prev) => prev, // keeps old data while fetching
  });

// Component - clean usage
const { data, isLoading, error } = useQuery(
  usersListQueryOptions(pagination)
);`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
