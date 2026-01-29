# Demo: POST User - Server Function → data-service (Binding)

## Overview

This demo showcases **Pattern B**: a server function calls `data-service` via Cloudflare's **service binding** (`DATA_SERVICE`). This pattern centralizes business logic in data-service while providing SSR support and server-side validation.

## Data Flow Diagram

```
┌──────────────────┐
│     Browser      │
│  (React Client)  │
│                  │
│  TanStack Form   │
│  with FormData   │
└────────┬─────────┘
         │
         │ 1. Form submit (POST)
         │    Native HTML form or JS
         │
         ▼
┌──────────────────────────────────────┐
│        user-application              │
│        (Server Function)             │
│                                      │
│  • Auth middleware (session check)   │
│  • Server-side Zod validation        │
│  • createServerValidate              │
└────────┬─────────────────────────────┘
         │
         │ 2. env.DATA_SERVICE.fetch()
         │    Internal network (no CORS)
         │
         ▼
┌──────────────────────────────────────┐
│          data-service                │
│          (Hono API)                  │
│                                      │
│  • Auth middleware (API token)       │
│  • Zod validation (again)            │
│  • Business logic                    │
│  • Rate limiting                     │
└────────┬─────────────────────────────┘
         │
         │ 3. user-service.createUser()
         │
         ▼
┌──────────────────┐
│    data-ops      │
│  (mock/database) │
└────────┬─────────┘
         │
         │ 4. Returns created user
         │
         ▼
┌──────────────────┐
│     Browser      │
│  Form success or │
│  validation error│
└──────────────────┘
```

## When to Use This Pattern

**Good fit:**
- CRUD operations with business logic that should be centralized
- Operations that external clients (mobile, third-party) also need
- When data-service already has the endpoint with validation/rate-limiting
- Single source of truth for data operations

**Avoid when:**
- Performance is critical (extra hop adds latency)
- Operation is user-application specific
- Simple queries with no business logic

## Pros and Cons

| Pros | Cons |
|------|------|
| Centralized business logic | Extra hop latency |
| Reusable endpoint (mobile, API) | Depends on data-service availability |
| Rate limiting at API level | Double validation (optional) |
| Internal network (no CORS) | More complex debugging |
| Audit logging in one place | Service binding configuration |
| Progressive enhancement | Requires API token management |

## Prerequisites

### 1. Service Binding (already configured)

`apps/user-application/wrangler.jsonc`:
```jsonc
{
  "env": {
    "dev": {
      "services": [
        {
          "binding": "DATA_SERVICE",
          "service": "saas-on-cf-ds-dev"
        }
      ]
    }
  }
}
```

### 2. API Token Secret

Add to `apps/user-application/.dev.vars`:
```env
DATA_SERVICE_API_TOKEN=your-secret-token
```

Add to `apps/data-service/.dev.vars`:
```env
API_TOKEN=your-secret-token
```

### 3. Update Worker Configuration Types

`apps/user-application/worker-configuration.d.ts`:
```typescript
interface Env {
  DATA_SERVICE: Fetcher;
  DATA_SERVICE_API_TOKEN: string;
}
```

## Implementation Steps

### Step 1: Create Form Options (Shared)

```typescript
// apps/user-application/src/core/forms/create-user-form.ts
import { createServerFn } from '@tanstack/react-start';
import {
  formOptions,
  createServerValidate,
  ServerValidateError,
  getFormData,
} from '@tanstack/react-form-start';
import { env } from 'cloudflare:workers';
import { UserCreateRequest, type UserCreateInput, type User } from '@repo/data-ops/zod-schema/user';

// Form options (shared between client/server)
export const createUserFormOpts = formOptions<UserCreateInput>({
  defaultValues: {
    name: '',
    email: '',
  },
});

// Server-side validation using Zod schema from data-ops
const serverValidate = createServerValidate({
  ...createUserFormOpts,
  onServerValidate: ({ value }) => {
    // Validate with shared Zod schema
    const result = UserCreateRequest.safeParse(value);
    if (!result.success) {
      return result.error.errors[0]?.message;
    }
    
    // Additional server-only validation
    if (value.email.endsWith('@blocked.com')) {
      return 'This email domain is not allowed';
    }
  },
});

// Server function to handle form submission
export const handleCreateUserViaBinding = createServerFn({
  method: 'POST',
})
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error('Invalid form data');
    }
    return data;
  })
  .handler(async (ctx) => {
    try {
      // 1. Server-side validation
      const validatedData = await serverValidate(ctx.data);
      
      // 2. Call data-service via service binding
      const response = await env.DATA_SERVICE.fetch(
        new Request('https://data-service/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
          },
          body: JSON.stringify(validatedData),
        })
      );
      
      // 3. Handle response
      if (!response.ok) {
        const error = await response.json() as { message?: string };
        
        if (response.status === 409) {
          throw new ServerValidateError({
            form: error.message || 'Email already exists',
          });
        }
        
        throw new Error(error.message || 'Failed to create user');
      }
      
      const user = await response.json() as User;
      return { success: true, user };
      
    } catch (e) {
      if (e instanceof ServerValidateError) {
        return e.response;
      }
      console.error('Create user error:', e);
      throw e;
    }
  });

// Server function for SSR form state
export const getCreateUserFormData = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getFormData();
  }
);
```

### Step 2: Create Demo Route

```tsx
// apps/user-application/src/routes/demo/user-create-binding.tsx
import { createFileRoute } from '@tanstack/react-router';
import {
  mergeForm,
  useForm,
  useTransform,
} from '@tanstack/react-form-start';
import { useStore } from '@tanstack/react-store';
import { useState } from 'react';
import {
  createUserFormOpts,
  handleCreateUserViaBinding,
  getCreateUserFormData,
} from '@/core/forms/create-user-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/user-create-binding')({
  component: UserCreateBindingDemo,
  loader: async () => ({
    formState: await getCreateUserFormData(),
  }),
});

function UserCreateBindingDemo() {
  const { formState } = Route.useLoaderData();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm({
    ...createUserFormOpts,
    transform: useTransform(
      (baseForm) => mergeForm(baseForm, formState),
      [formState]
    ),
  });

  const formErrors = useStore(form.store, (state) => state.errors);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">POST User - Server → data-service (Binding)</h2>
        <p className="text-muted-foreground mt-1">
          Server function calls data-service via Cloudflare service binding
        </p>
      </div>

      {/* Data Flow Description */}
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (TanStack Form)
    │
    │ 1. Form submit (POST)
    │    action={handleCreateUserViaBinding.url}
    │    encType="multipart/form-data"
    │
    ▼
Server Function (user-application)
    │
    │ 2. serverValidate(formData)
    │    - Zod validation (UserCreateRequest)
    │    - Custom validation (blocked domains)
    │
    ▼
env.DATA_SERVICE.fetch('https://data-service/users', {
  method: 'POST',
  headers: { Authorization: 'Bearer <token>' },
  body: JSON.stringify(validatedData)
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
Response → Server Function → Browser`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Centralized business logic</li>
                <li>Reusable endpoint (mobile, API)</li>
                <li>Rate limiting at API level</li>
                <li>Internal network (no CORS)</li>
                <li>Progressive enhancement</li>
                <li>Audit logging in one place</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Extra hop latency</li>
                <li>Depends on data-service availability</li>
                <li>Double validation (optional)</li>
                <li>More complex debugging</li>
                <li>API token management</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for CRUD operations with business logic that should be centralized,
              operations needed by external clients, and when data-service already 
              has the endpoint with validation/rate-limiting.
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

      {/* Interactive Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo - Create User Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Success Message */}
          {successMessage && (
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Form-level Errors */}
          {formErrors.map((error) => (
            <Alert key={error as string} variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ))}

          <form
            action={handleCreateUserViaBinding.url}
            method="post"
            encType="multipart/form-data"
            className="space-y-4"
            onSubmit={(e) => {
              // For demo: handle client-side to show response
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleCreateUserViaBinding({ data: formData })
                .then((result) => {
                  if ('success' in result && result.success) {
                    setSuccessMessage(`User "${result.user.name}" created successfully!`);
                    form.reset();
                  }
                })
                .catch((err) => {
                  console.error(err);
                });
            }}
          >
            {/* Name Field */}
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) =>
                  value.length < 2 ? 'Name must be at least 2 characters' : undefined,
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
                    name={field.name}
                    placeholder="John Doe"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error as string} className="text-red-500 text-sm">
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            {/* Email Field */}
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Email is required';
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return 'Invalid email format';
                  }
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
                    name={field.name}
                    type="email"
                    placeholder="john@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error as string} className="text-red-500 text-sm">
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            {/* Submit Button */}
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="text-sm text-muted-foreground">
            <p><strong>Try:</strong></p>
            <ul className="list-disc list-inside">
              <li>Valid email → Success</li>
              <li>Email ending in @blocked.com → Server validation error</li>
              <li>Duplicate email → API conflict error</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Code Example */}
      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// Server Function with service binding
import { env } from 'cloudflare:workers';

export const handleCreateUserViaBinding = createServerFn({ method: 'POST' })
  .validator((data) => {
    if (!(data instanceof FormData)) throw new Error('Invalid form data');
    return data;
  })
  .handler(async (ctx) => {
    // 1. Server-side validation
    const validatedData = await serverValidate(ctx.data);
    
    // 2. Call data-service via binding (internal network)
    const response = await env.DATA_SERVICE.fetch(
      new Request('https://data-service/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${env.DATA_SERVICE_API_TOKEN}\`,
        },
        body: JSON.stringify(validatedData),
      })
    );
    
    // 3. Handle response
    if (!response.ok) {
      const error = await response.json();
      throw new ServerValidateError({ form: error.message });
    }
    
    return { success: true, user: await response.json() };
  });

// Form component
<form
  action={handleCreateUserViaBinding.url}
  method="post"
  encType="multipart/form-data"
>
  <form.Field name="name" validators={{...}}>
    {(field) => <Input {...fieldProps} />}
  </form.Field>
</form>`}
          </pre>
        </CardContent>
      </Card>

      {/* Why Service Binding */}
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
```

## Testing

1. **Start both services:**
   ```bash
   # Terminal 1
   cd apps/data-service && pnpm dev
   
   # Terminal 2
   cd apps/user-application && pnpm dev
   ```

2. **Navigate to demo:**
   Open `http://localhost:5173/demo/user-create-binding`

3. **Test validation:**
   - Empty form → Client validation errors
   - @blocked.com email → Server validation error
   - Valid data → Success message

4. **Test API error:**
   - Create user, then try same email → Conflict error from data-service

5. **Test progressive enhancement:**
   - Disable JavaScript in browser
   - Submit form
   - Form should still work via native submission

## Related Patterns

- [004 - GET Users (Client → API)](./004-get-users-client-api.md) - Read via direct API
- [005 - GET User (Server → data-ops)](./005-get-user-direct-dataops.md) - Read via direct data-ops
- [007 - PUT User (Server → data-ops)](./007-put-user-direct-dataops.md) - Update via direct data-ops
