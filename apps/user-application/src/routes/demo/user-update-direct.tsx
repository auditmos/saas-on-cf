import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { getUserDataOps } from '@/core/functions/user-queries';
import { updateUserDirect } from '@/core/functions/user-mutations';
import { userKeys } from '@/lib/query-keys';
import type { User } from '@repo/data-ops/zod-schema/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const searchSchema = z.object({
  userId: z.string().default('1'),
  editing: z.boolean().default(false),
});

const userDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: userKeys.detail(id),
    queryFn: () => getUserDataOps({ data: { id } }),
    staleTime: 1000 * 60,
  });

export const Route = createFileRoute('/demo/user-update-direct')({
  component: UserUpdateDirectDemo,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ userId: search.userId }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(userDetailQueryOptions(deps.userId));
  },
});

interface UpdateFormValues {
  name: string;
  email: string;
}

function UserUpdateDirectDemo() {
  const { userId, editing } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error: fetchError, isFetching } = useQuery({
    ...userDetailQueryOptions(userId),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      updateUserDirect({ data: { id: userId, data } }),

    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: userKeys.detail(userId) });
      const previousUser = queryClient.getQueryData<User | null>(userKeys.detail(userId));
      queryClient.setQueryData<User | null>(userKeys.detail(userId), (old) =>
        old ? { ...old, ...newData } : old
      );
      return { previousUser };
    },

    onError: (_err, _newData, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.detail(userId), context.previousUser);
      }
    },

    onSuccess: (result) => {
      if (result.success) {
        navigate({ to: '/demo/user-update-direct', search: { userId, editing: false } });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
    },
  });

  const form = useForm({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    } satisfies UpdateFormValues,
    onSubmit: async ({ value }) => {
      const updates: { name?: string; email?: string } = {};
      if (value.name !== user?.name) updates.name = value.name;
      if (value.email !== user?.email) updates.email = value.email;

      if (Object.keys(updates).length > 0) {
        updateMutation.mutate(updates);
      } else {
        navigate({ to: '/demo/user-update-direct', search: { userId, editing: false } });
      }
    },
  });

  const handleSearch = (newId: string) => {
    navigate({ to: '/demo/user-update-direct', search: { userId: newId, editing: false } });
  };

  const handleStartEdit = () => {
    if (user) {
      form.setFieldValue('name', user.name);
      form.setFieldValue('email', user.email);
      navigate({ to: '/demo/user-update-direct', search: { userId, editing: true } });
    }
  };

  const handleCancelEdit = () => {
    navigate({ to: '/demo/user-update-direct', search: { userId, editing: false } });
  };

  const mutationError = updateMutation.data && !updateMutation.data.success
    ? updateMutation.data.error
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PUT User - Server → data-ops (Direct)</h2>
        <p className="text-muted-foreground mt-1">
          Server function directly mutates via data-ops package (mocks)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (TanStack Form + useMutation)
    │
    │ 1. Form validation → mutation.mutate()
    │    + Optimistic update applied to cache
    │
    ▼
Server Function (updateUserDirect)
    │
    │ 2. Auth middleware → Zod validation → Authorization
    │
    ▼
import { updateUser } from '@repo/data-ops/queries/user'
    │
    │ 3. Direct function call (no network)
    │
    ▼
data-ops: updateUser(id, data)
    │
    │ 4. Mock store update
    │    (with email uniqueness check)
    │
    ▼
Response → Success: keep optimistic update
        → Error: rollback to previous state`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Lowest latency (no extra hop)</li>
                <li>Full transaction control</li>
                <li>Optimistic updates work well</li>
                <li>Can combine multiple updates</li>
                <li>Direct ORM access</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Logic not shared with data-service</li>
                <li>No automatic rate limiting</li>
                <li>Audit logging must be added</li>
                <li>Testing requires DB setup</li>
              </ul>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded">
            <h4 className="font-semibold">Optimistic Updates</h4>
            <p className="text-sm mt-1">
              UI updates immediately before server responds. On error, automatically
              rolls back to previous state.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo - Edit User</CardTitle>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button type="submit" disabled={isFetching}>
              {isFetching ? 'Loading...' : 'Search'}
            </Button>
          </form>

          {(fetchError || mutationError) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {fetchError instanceof Error ? fetchError.message : mutationError}
              </AlertDescription>
            </Alert>
          )}

          {updateMutation.data?.success && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>User updated successfully!</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading user...</span>
            </div>
          )}

          {user && (
            <div className="border rounded p-4 space-y-4">
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    form.handleSubmit();
                  }}
                  className="space-y-4"
                >
                  <form.Field
                    name="name"
                    validators={{
                      onChange: ({ value }) => (!value ? 'Name is required' : undefined),
                      onBlur: ({ value }) =>
                        value.length > 30 ? 'Name must be at most 30 characters' : undefined,
                    }}
                  >
                    {(field) => (
                      <div className="space-y-1">
                        <label htmlFor={field.name} className="text-sm font-medium">
                          Name
                        </label>
                        <Input
                          id={field.name}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-red-500 text-sm">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  <form.Field
                    name="email"
                    validators={{
                      onChange: ({ value }) => {
                        if (!value) return 'Email is required';
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email';
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-1">
                        <label htmlFor={field.name} className="text-sm font-medium">
                          Email
                        </label>
                        <Input
                          id={field.name}
                          type="email"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={String(error)} className="text-red-500 text-sm">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  <div className="flex gap-2">
                    <form.Subscribe selector={(state) => state.canSubmit}>
                      {(canSubmit) => (
                        <Button type="submit" disabled={!canSubmit || updateMutation.isPending}>
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                    </form.Subscribe>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono">{user.id}</span>
                    <span className="text-muted-foreground">Name:</span>
                    <span>{user.name}</span>
                    <span className="text-muted-foreground">Email:</span>
                    <span>{user.email}</span>
                  </div>
                  <Button onClick={handleStartEdit}>Edit User</Button>
                </>
              )}
            </div>
          )}

          {!isLoading && !fetchError && !user && (
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
{`// Search params for URL state
const searchSchema = z.object({
  userId: z.string().default('1'),
  editing: z.boolean().default(false),
});

export const Route = createFileRoute('/demo/user-update-direct')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ userId: search.userId }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      userDetailQueryOptions(deps.userId)
    );
  },
});

// useMutation with optimistic updates
const updateMutation = useMutation({
  mutationFn: (data) => updateUserDirect({ data: { id: userId, data } }),
  onMutate: async (newData) => {
    const previous = queryClient.getQueryData(userKeys.detail(userId));
    queryClient.setQueryData(userKeys.detail(userId), (old) => ({
      ...old, ...newData
    }));
    return { previous };
  },
  onError: (err, newData, ctx) => {
    queryClient.setQueryData(userKeys.detail(userId), ctx.previous);
  },
  onSuccess: (result) => {
    if (result.success) navigate({ to: '/demo/user-update-direct', search: { userId, editing: false } });
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
  },
});`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direct vs Binding Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Aspect</th>
                <th className="text-left p-2">Direct (This)</th>
                <th className="text-left p-2">Via Binding</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">Latency</td>
                <td className="p-2 text-green-600">Lowest (1 hop)</td>
                <td className="p-2 text-orange-600">Higher (2 hops)</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Transaction control</td>
                <td className="p-2 text-green-600">Full</td>
                <td className="p-2 text-orange-600">Limited to API</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Logic sharing</td>
                <td className="p-2 text-orange-600">App-specific</td>
                <td className="p-2 text-green-600">Shared with API</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Rate limiting</td>
                <td className="p-2 text-orange-600">Must implement</td>
                <td className="p-2 text-green-600">API handles</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
