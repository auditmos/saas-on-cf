import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { userDetailDirectQueryOptions } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const searchSchema = z.object({
  userId: z.string().optional(),
});

export const Route = createFileRoute('/demo/direct/read')({
  component: DirectReadPage,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ userId: search.userId }),
  loader: async ({ context, deps }) => {
    if (deps.userId) {
      await context.queryClient.ensureQueryData(userDetailDirectQueryOptions(deps.userId));
    }
  },
});

function DirectReadPage() {
  const { userId } = Route.useSearch();
  const navigate = useNavigate();

  const { data: user, isLoading, error, isFetching } = useQuery({
    ...userDetailDirectQueryOptions(userId ?? ''),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });

  const handleSearch = (newId: string) => {
    navigate({ to: '/demo/direct/read', search: { userId: newId } });
  };

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
    │    queryClient.ensureQueryData(...)
    ▼
Server Function (getUserDirect)
    │
    │ 2. Zod validation
    ▼
import { getUser } from '@repo/data-ops/queries/user'
    │
    │ 3. Direct Drizzle query
    ▼
Response → React Query cache → Component`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Read User</CardTitle>
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
            <Input name="searchId" placeholder="Enter user ID (UUID)" defaultValue={userId ?? ''} />
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
              <span>Loading...</span>
            </div>
          )}

          {user && (
            <div className="border rounded p-4">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{user.id}</span>
                <span className="text-muted-foreground">Name:</span>
                <span>{user.name}</span>
                <span className="text-muted-foreground">Surname:</span>
                <span>{user.surname}</span>
                <span className="text-muted-foreground">Email:</span>
                <span>{user.email}</span>
              </div>
            </div>
          )}

          {!isLoading && !error && !user && userId && (
            <Alert>
              <AlertTitle>Not Found</AlertTitle>
              <AlertDescription>No user found with ID: {userId}</AlertDescription>
            </Alert>
          )}

          {!userId && (
            <Alert>
              <AlertTitle>Enter User ID</AlertTitle>
              <AlertDescription>Enter a UUID from the List page to fetch user details</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// Route with SSR + URL params
const searchSchema = z.object({ userId: z.string().default('1') });

export const Route = createFileRoute('/demo/direct/read')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ userId: search.userId }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      userDetailDirectQueryOptions(deps.userId)
    );
  },
});

// Component uses cached data
const { data: user } = useQuery({
  ...userDetailDirectQueryOptions(userId),
  placeholderData: (prev) => prev,
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
