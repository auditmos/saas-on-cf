import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { usersListDirectQueryOptions } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const defaultPagination = { limit: 5, offset: 0 };

export const Route = createFileRoute('/demo/direct/list')({
  component: DirectListPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(usersListDirectQueryOptions(defaultPagination));
  },
});

function DirectListPage() {
  const [pagination, setPagination] = useState(defaultPagination);

  const { data, isLoading, error, isFetching, refetch } = useQuery(
    usersListDirectQueryOptions(pagination)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser Navigation
    │
    │ 1. Route loader runs (SSR)
    ▼
Server Function (getUsersDirect)
    │
    │ 2. Zod validation (PaginationRequestSchema)
    ▼
import { getUsers } from '@repo/data-ops/queries/user'
    │
    │ 3. Drizzle query with limit/offset + count
    ▼
Response → React Query cache → Table render`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Failed to fetch users'}
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading...</span>
            </div>
          )}

          {data && (
            <>
              <div className="border rounded">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Surname</th>
                      <th className="text-left p-2">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((user) => (
                      <tr key={user.id} className="border-t">
                        <td className="p-2 font-mono text-sm">{user.id}</td>
                        <td className="p-2">{user.name}</td>
                        <td className="p-2">{user.surname}</td>
                        <td className="p-2">{user.email}</td>
                      </tr>
                    ))}
                    {data.data.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1} - {pagination.offset + data.data.length} of {data.pagination.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.offset === 0}
                    onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasMore}
                    onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}

          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refetching...' : 'Refetch'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// lib/query-keys.ts
export const usersListDirectQueryOptions = (params) =>
  queryOptions({
    queryKey: userKeys.list(params, 'direct'),
    queryFn: () => getUsersDirect({ data: params }),
    placeholderData: (prev) => prev,
  });

// Route with SSR
export const Route = createFileRoute('/demo/direct/list')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      usersListDirectQueryOptions(defaultPagination)
    );
  },
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
