import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchUser, updateUserApi, ApiError } from '@/lib/api-client';
import { userKeys } from '@/lib/query-keys';
import type { User } from '@repo/data-ops/zod-schema/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const searchSchema = z.object({
  userId: z.string().optional(),
  editing: z.boolean().default(false),
});

export const Route = createFileRoute('/demo/api/update')({
  component: ApiUpdatePage,
  validateSearch: searchSchema,
});

function ApiUpdatePage() {
  const { userId, editing } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error: fetchError, isFetching } = useQuery({
    queryKey: userKeys.detail(userId, 'api'),
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; surname?: string; email?: string }) => updateUserApi(userId!, data),

    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: userKeys.detail(userId!, 'api') });
      const previousUser = queryClient.getQueryData<User | null>(userKeys.detail(userId!, 'api'));
      queryClient.setQueryData<User | null>(userKeys.detail(userId!, 'api'), (old) =>
        old ? { ...old, ...newData } : old
      );
      return { previousUser };
    },

    onError: (_err, _newData, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.detail(userId!, 'api'), context.previousUser);
      }
    },

    onSuccess: () => {
      navigate({ to: '/demo/api/update', search: { userId, editing: false } });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId!, 'api') });
    },
  });

  const form = useForm({
    defaultValues: { name: user?.name ?? '', surname: user?.surname ?? '', email: user?.email ?? '' },
    onSubmit: async ({ value }) => {
      const updates: { name?: string; surname?: string; email?: string } = {};
      if (value.name !== user?.name) updates.name = value.name;
      if (value.surname !== user?.surname) updates.surname = value.surname;
      if (value.email !== user?.email) updates.email = value.email;

      if (Object.keys(updates).length > 0) {
        updateMutation.mutate(updates);
      } else {
        navigate({ to: '/demo/api/update', search: { userId, editing: false } });
      }
    },
  });

  const handleSearch = (newId: string) => {
    navigate({ to: '/demo/api/update', search: { userId: newId, editing: false } });
  };

  const handleStartEdit = () => {
    if (user) {
      form.setFieldValue('name', user.name);
      form.setFieldValue('surname', user.surname);
      form.setFieldValue('email', user.email);
      navigate({ to: '/demo/api/update', search: { userId, editing: true } });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (TanStack Form + useMutation)
    │
    │ 1. Form submit → mutation.mutate()
    │    + Optimistic update to cache
    ▼
fetch('${import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8788'}/users/:id', {
  method: 'PUT',
  body: JSON.stringify(data)
})
    │
    │ 2. HTTP PUT (crosses public internet)
    ▼
data-service (Hono API)
    │
    │ 3. CORS check → authMiddleware → zValidator
    │    → userService.updateUser()
    ▼
Response → Success: keep optimistic
         → Error: rollback cache`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update User</CardTitle>
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

          {fetchError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {fetchError instanceof ApiError
                  ? `${fetchError.message} (${fetchError.status})`
                  : fetchError instanceof Error
                    ? fetchError.message
                    : 'Failed to fetch user'}
              </AlertDescription>
            </Alert>
          )}

          {updateMutation.isError && (
            <Alert variant="destructive">
              <AlertTitle>Update Error</AlertTitle>
              <AlertDescription>
                {updateMutation.error instanceof ApiError
                  ? `${updateMutation.error.message} (${updateMutation.error.status})`
                  : updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : 'Failed to update'}
              </AlertDescription>
            </Alert>
          )}

          {updateMutation.isSuccess && (
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>User updated!</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading...</span>
            </div>
          )}

          {user && (
            <div className="border rounded p-4 space-y-4">
              {editing ? (
                <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="space-y-4">
                  <form.Field
                    name="name"
                    validators={{ onChange: ({ value }) => (!value ? 'Required' : undefined) }}
                  >
                    {(field) => (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Name</label>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.map((err) => (
                          <p key={String(err)} className="text-destructive text-sm">{err}</p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  <form.Field
                    name="surname"
                    validators={{ onChange: ({ value }) => (!value ? 'Required' : undefined) }}
                  >
                    {(field) => (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Surname</label>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.map((err) => (
                          <p key={String(err)} className="text-destructive text-sm">{err}</p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  <form.Field
                    name="email"
                    validators={{
                      onChange: ({ value }) => {
                        if (!value) return 'Required';
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email';
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                          type="email"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.map((err) => (
                          <p key={String(err)} className="text-destructive text-sm">{err}</p>
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
                      onClick={() => navigate({ to: '/demo/api/update', search: { userId, editing: false } })}
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
                    <span className="text-muted-foreground">Surname:</span>
                    <span>{user.surname}</span>
                    <span className="text-muted-foreground">Email:</span>
                    <span>{user.email}</span>
                  </div>
                  <Button onClick={handleStartEdit}>Edit</Button>
                </>
              )}
            </div>
          )}

          {!isLoading && !fetchError && !user && userId && (
            <Alert>
              <AlertTitle>Not Found</AlertTitle>
              <AlertDescription>No user found with ID: {userId}</AlertDescription>
            </Alert>
          )}

          {!userId && (
            <Alert>
              <AlertTitle>Enter User ID</AlertTitle>
              <AlertDescription>Enter a UUID from the List page to update a user</AlertDescription>
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
{`// Route with URL search params (TanStack Router recommended)
const searchSchema = z.object({
  userId: z.string().optional(),
  editing: z.boolean().default(false),
});

export const Route = createFileRoute('/demo/api/update')({
  validateSearch: searchSchema,
});

// Component - URL-driven state
const { userId, editing } = Route.useSearch();
const navigate = useNavigate();

// Navigate updates URL search params
const handleStartEdit = () => {
  navigate({ to: '/demo/api/update', search: { userId, editing: true } });
};

// Mutation with optimistic updates
const updateMutation = useMutation({
  mutationFn: (data) => updateUserApi(userId, data),
  onSuccess: () => {
    navigate({ to: '/demo/api/update', search: { userId, editing: false } });
  },
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
