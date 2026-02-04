import { createFileRoute } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleCreateUserViaBinding } from '@/core/forms/create-user-form';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/user-create-binding')({
  component: UserCreateBindingDemo,
});

function UserCreateBindingDemo() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      handleCreateUserViaBinding({ data }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
        form.reset();
      }
    },
  });

  const form = useForm({
    defaultValues: { name: '', email: '' },
    onSubmit: async ({ value }) => {
      mutation.reset();
      mutation.mutate(value);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          POST User - Server → data-service (Binding)
        </h2>
        <p className="text-muted-foreground mt-1">
          Server function calls data-service via Cloudflare service binding
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
            {`Browser (TanStack Form)
    │
    │ 1. Client validation (onChange/onBlur)
    │    form.handleSubmit()
    │
    ▼
Server Function (handleCreateUserViaBinding)
    │
    │ 2. Server Zod validation (validator)
    │    Custom validation (blocked domains)
    │
    ▼
env.DATA_SERVICE.fetch('https://data-service/users', {
  method: 'POST',
  headers: { Authorization: 'Bearer <token>' },
  body: JSON.stringify(data)
})
    │
    │ 3. Internal network call (no CORS)
    │
    ▼
data-service (Hono API)
    │
    │ 4. authMiddleware → zValidator → userService.createUser()
    │
    ▼
Response → queryClient.invalidateQueries()`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Centralized business logic</li>
                <li>Reusable endpoint (mobile, API)</li>
                <li>Rate limiting at API level</li>
                <li>Internal network (no CORS)</li>
                <li>Cache invalidation on success</li>
                <li>TanStack Form client validation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Extra hop latency</li>
                <li>Depends on data-service availability</li>
                <li>Validation on both client + server</li>
                <li>More complex debugging</li>
                <li>API token management</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for CRUD operations with business logic that should be
              centralized, operations needed by external clients, and when
              data-service already has the endpoint with validation/rate-limiting.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded">
            <h4 className="font-semibold">Service Binding Advantage</h4>
            <p className="text-sm mt-1">
              Unlike direct API calls, service bindings use Cloudflare's internal
              network. The hostname in the URL is ignored - requests go directly
              to the bound worker without CORS or public network latency.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo - Create User Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mutation.isSuccess && mutation.data.success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                User "{mutation.data.user.name}" created!
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
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) =>
                  !value ? 'Name is required' : undefined,
                onBlur: ({ value }) =>
                  value.length > 30 ? 'Name must be at most 30 characters' : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-1">
                  <label htmlFor={field.name} className="text-sm font-medium">Name</label>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="John Doe"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error as string} className="text-red-500 text-sm">{error}</p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Email is required';
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
                },
              }}
            >
              {(field) => (
                <div className="space-y-1">
                  <label htmlFor={field.name} className="text-sm font-medium">Email</label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="john@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error as string} className="text-red-500 text-sm">{error}</p>
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

          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Try:</strong>
            </p>
            <ul className="list-disc list-inside">
              <li>Valid email → Success</li>
              <li>Email ending in @blocked.com → Server validation error</li>
              <li>Duplicate email → API conflict error</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
            {`// useMutation for submission state
const mutation = useMutation({
  mutationFn: (data) => handleCreateUserViaBinding({ data }),
  onSuccess: (result) => {
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      form.reset();
    }
    // Server errors shown via mutation.data.error in Alert
  },
});

// TanStack Form with onSubmit calling mutation
const form = useForm({
  defaultValues: { name: '', email: '' },
  onSubmit: ({ value }) => {
    mutation.reset();
    mutation.mutate(value);
  },
});

// Field with client validation
<form.Field
  name="name"
  validators={{
    onChange: ({ value }) => !value ? 'Required' : undefined,
  }}
>
  {(field) => <Input ... />}
</form.Field>

// Button uses mutation.isPending
<Button disabled={!canSubmit || mutation.isPending}>
  {mutation.isPending ? 'Creating...' : 'Create User'}
</Button>`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why Service Binding vs Direct API?</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Aspect</th>
                <th className="text-left p-2">Service Binding</th>
                <th className="text-left p-2">Direct API Call</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">Network</td>
                <td className="p-2 text-green-600">Internal (faster)</td>
                <td className="p-2 text-orange-600">Public internet</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">CORS</td>
                <td className="p-2 text-green-600">Not needed</td>
                <td className="p-2 text-orange-600">Required</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Auth</td>
                <td className="p-2">API token (server-side)</td>
                <td className="p-2">Client token (exposed)</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Cost</td>
                <td className="p-2 text-green-600">No egress</td>
                <td className="p-2 text-orange-600">Network egress</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Hostname</td>
                <td className="p-2">Ignored (goes to bound worker)</td>
                <td className="p-2">Must be correct public URL</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
