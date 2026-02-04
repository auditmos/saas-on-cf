import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { userDetailQueryOptions } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const searchSchema = z.object({
  userId: z.string().default('1'),
});

export const Route = createFileRoute('/demo/user-detail-direct')({
  component: UserDetailDirectDemo,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ userId: search.userId }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(userDetailQueryOptions(deps.userId));
  },
});

function UserDetailDirectDemo() {
  const { userId } = Route.useSearch();
  const navigate = useNavigate();

  const { data: user, isLoading, error, isFetching } = useQuery({
    ...userDetailQueryOptions(userId),
    placeholderData: (prev) => prev,
  });

  const handleSearch = (newId: string) => {
    navigate({ to: '/demo/user-detail-direct', search: { userId: newId } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">GET User - Server → data-ops (Direct)</h2>
        <p className="text-muted-foreground mt-1">
          Server function queries data-ops directly, bypassing API layer
        </p>
      </div>

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
Server Function (getUserDataOps)
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
                <li>Lowest latency (no extra hop)</li>
                <li>Direct ORM access</li>
                <li>Shareable URLs via search params</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Logic not shared with data-service</li>
                <li>No automatic rate limiting</li>
                <li>Testing requires DB setup</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for SSR with lowest latency, when data-service endpoint not needed,
              and when you want full transaction control.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newId = formData.get('searchId') as string;
              if (newId && newId !== userId) handleSearch(newId);
            }}
            className="flex gap-2"
          >
            <Input
              name="searchId"
              placeholder="Enter user ID"
              defaultValue={userId}
            />
            <Button type="submit" disabled={isFetching}>
              {isFetching ? 'Loading...' : 'Search'}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Failed to fetch user'}
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading user...</span>
            </div>
          )}

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

          {!isLoading && !error && !user && (
            <Alert>
              <AlertTitle>Not Found</AlertTitle>
              <AlertDescription>No user found with ID: {userId}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// Centralized query options (lib/query-keys.ts)
export const userDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: () => getUserDataOps({ data: { id } }),
    staleTime: 1000 * 60,
  });

// Route with SSR + URL params
const searchSchema = z.object({ userId: z.string().default('1') });

export const Route = createFileRoute('/demo/user-detail-direct')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ userId: search.userId }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      userDetailQueryOptions(deps.userId)
    );
  },
});

// Component - data in cache, URL-driven state
const { userId } = Route.useSearch();
const { data } = useQuery({
  ...userDetailQueryOptions(userId),
  placeholderData: (prev) => prev,
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
