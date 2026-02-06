import { createFileRoute } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUserDirect } from '@/core/functions/users/direct';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/direct/create')({
  component: DirectCreatePage,
});

function DirectCreatePage() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { name: string; surname: string; email: string }) =>
      createUserDirect({ data }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
        form.reset();
      }
    },
  });

  const form = useForm({
    defaultValues: { name: '', surname: '', email: '' },
    onSubmit: async ({ value }) => {
      mutation.reset();
      mutation.mutate(value);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (TanStack Form)
    │
    │ 1. Client validation → mutation.mutate()
    ▼
Server Function (createUserDirect)
    │
    │ 2. Zod validation (UserCreateRequestSchema)
    ▼
import { createUser } from '@repo/data-ops/queries/user'
    │
    │ 3. Direct DB insert with .returning()
    ▼
Response → queryClient.invalidateQueries()`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mutation.isSuccess && mutation.data.success && (
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                User "{mutation.data.user.name}" created (ID: {mutation.data.user.id})
              </AlertDescription>
            </Alert>
          )}

          {mutation.isSuccess && !mutation.data.success && (
            <Alert variant="destructive">
              <AlertDescription>{mutation.data.error}</AlertDescription>
            </Alert>
          )}

          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {mutation.error instanceof Error ? mutation.error.message : 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}

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
              }}
            >
              {(field) => (
                <div className="space-y-1">
                  <label htmlFor={field.name} className="text-sm font-medium">Name</label>
                  <Input
                    id={field.name}
                    placeholder="John"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={String(error)} className="text-destructive text-sm">{error}</p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field
              name="surname"
              validators={{
                onChange: ({ value }) => (!value ? 'Surname is required' : undefined),
              }}
            >
              {(field) => (
                <div className="space-y-1">
                  <label htmlFor={field.name} className="text-sm font-medium">Surname</label>
                  <Input
                    id={field.name}
                    placeholder="Doe"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={String(error)} className="text-destructive text-sm">{error}</p>
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
                },
              }}
            >
              {(field) => (
                <div className="space-y-1">
                  <label htmlFor={field.name} className="text-sm font-medium">Email</label>
                  <Input
                    id={field.name}
                    type="email"
                    placeholder="john@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={String(error)} className="text-destructive text-sm">{error}</p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.canSubmit}>
              {(canSubmit) => (
                <Button type="submit" disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// core/functions/users/direct.ts
export const createUserDirect = createServerFn({ method: 'POST' })
  .inputValidator((data) => UserCreateRequestSchema.parse(data))
  .handler(async (ctx) => {
    const user = await createUser(ctx.data);
    return { success: true, user };
  });

// Component
const mutation = useMutation({
  mutationFn: (data) => createUserDirect({ data }),
  onSuccess: (result) => {
    if (result.success) queryClient.invalidateQueries({ queryKey: userKeys.all });
  },
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
