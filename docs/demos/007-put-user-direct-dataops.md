# Demo: PUT User - Server Function → data-ops (Direct Mutation)

## Overview

This demo showcases **Pattern C for mutations**: a server function directly calls `data-ops` to update data, bypassing `data-service`. This pattern offers the lowest latency for writes and full transaction control.

**Note:** Currently uses mocks that mirror the future Neon database interface. When migrating to Neon, only the internal implementation changes - the interface stays the same.

## Data Flow Diagram

```
┌──────────────────┐
│     Browser      │
│  (React Client)  │
│                  │
│  TanStack Form   │
│  + useMutation   │
└────────┬─────────┘
         │
         │ 1. Form validation → mutation.mutate()
         │
         ▼
┌──────────────────────────────────────┐
│        user-application              │
│        (Server Function)             │
│                                      │
│  • Auth middleware (session check)   │
│  • Server-side Zod validation        │
│  • Authorization check (ownership)   │
└────────┬─────────────────────────────┘
         │
         │ 2. Direct import call
         │    (no network hop)
         │
         ▼
┌──────────────────────────────────────┐
│           data-ops                   │
│        queries/user.ts               │
│                                      │
│  updateUser(id, data)                │
│  - Drizzle ORM update                │
│  - Transaction support               │
└────────┬─────────────────────────────┘
         │
         │ 3. SQL UPDATE query
         │
         ▼
┌──────────────────┐
│   D1 Database    │
└────────┬─────────┘
         │
         │ 4. Returns updated user
         │
         ▼
┌──────────────────┐
│     Browser      │
│  Optimistic      │
│  update resolved │
└──────────────────┘
```

## When to Use This Pattern

**Good fit:**
- App-specific mutations (not needed by external clients)
- Performance-critical updates
- Complex transactions with rollback
- Updates requiring multiple related changes
- When you need optimistic updates with guaranteed consistency

**Avoid when:**
- Same mutation needed by mobile app / external clients
- Business logic should be centralized in data-service
- Mutation needs data-service rate limiting/audit logging

## Pros and Cons

| Pros | Cons |
|------|------|
| Lowest latency (no extra hop) | Logic not shared with data-service |
| Full transaction control | Requires D1 binding |
| Optimistic updates work well | Business logic may diverge |
| Can combine multiple updates | No automatic rate limiting |
| Direct Drizzle ORM access | Testing requires DB setup |
| Server session auth (simpler) | Audit logging must be added |

## Prerequisites

### 1. Mock-Based Query Interface

The `updateUser` function is defined in `packages/data-ops/src/queries/user.ts`:

```typescript
import { mockUsers } from '../mocks/user-mock';
import type { User, UserUpdateInput } from '../zod-schema/user';

/**
 * Update user - uses mock store (will use Neon later)
 */
export async function updateUser(
  userId: string, 
  data: UserUpdateInput
): Promise<User | null> {
  // Check if user exists
  const existing = mockUsers.findById(userId);
  if (!existing) {
    return null;
  }
  
  // Check email uniqueness if email is being changed
  if (data.email && data.email !== existing.email) {
    const emailExists = mockUsers.findByEmail(data.email);
    if (emailExists) {
      throw new Error('EMAIL_EXISTS');
    }
  }
  
  // Update using mock store
  return mockUsers.update(userId, data);
}
```

### 2. Future Migration to Neon

When ready to use Neon database:

```typescript
// Future implementation with Drizzle
export async function updateUser(
  userId: string, 
  data: UserUpdateInput
): Promise<User | null> {
  const db = getDb();
  
  const [updated] = await db
    .update(users)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  
  return updated ?? null;
}
```

The interface stays the same - only internal implementation changes.

## Implementation Steps

### Step 1: Create Server Function for Update

```typescript
// apps/user-application/src/core/functions/user-mutations.ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { updateUser, getUser } from '@repo/data-ops/queries/user';
import { UserUpdateRequest, UserSchema, type User } from '@repo/data-ops/zod-schema/user';
import { protectedFunctionMiddleware } from '@/core/middleware/auth';

// Input schema for update
const UpdateUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
  data: UserUpdateRequest,
});

type UpdateUserInputType = z.infer<typeof UpdateUserInput>;

// Custom error for typed error handling
class MutationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MutationError';
  }
}

/**
 * Update user - Direct data-ops mutation
 * 
 * Data Flow: Browser → Server Function → data-ops → D1 → Response
 * 
 * Benefits:
 * - Lowest latency (single hop)
 * - Full transaction control
 * - Can combine multiple updates atomically
 */
export const updateUserDirect = createServerFn({ method: 'POST' })
  .middleware([protectedFunctionMiddleware])
  .validator((data: unknown): UpdateUserInputType => {
    return UpdateUserInput.parse(data);
  })
  .handler(async ({ data, context }): Promise<User> => {
    const { id, data: updateData } = data;
    const { session } = context;
    
    // Authorization: Check if user can update this resource
    // Example: Only allow self-update or admin
    const targetUser = await getUser(id);
    if (!targetUser) {
      throw new MutationError('User not found', 'NOT_FOUND', 404);
    }
    
    const isOwner = targetUser.id === session.user.id;
    const isAdmin = session.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      throw new MutationError(
        'You can only update your own profile',
        'FORBIDDEN',
        403
      );
    }
    
    try {
      // Direct call to data-ops mutation
      const updated = await updateUser(id, updateData);
      
      if (!updated) {
        throw new MutationError('Failed to update user', 'UPDATE_FAILED', 500);
      }
      
      // Validate output
      return UserSchema.parse(updated);
      
    } catch (error) {
      if (error instanceof MutationError) {
        throw error;
      }
      
      if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
        throw new MutationError(
          'Email already in use',
          'EMAIL_EXISTS',
          409
        );
      }
      
      throw new MutationError('Failed to update user', 'UNKNOWN', 500);
    }
  });
```

### Step 2: Create Demo Route

```tsx
// apps/user-application/src/routes/demo/user-update-direct.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { getUserDirect } from '@/core/functions/user-queries';
import { updateUserDirect } from '@/core/functions/user-mutations';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const Route = createFileRoute('/demo/user-update-direct')({
  component: UserUpdateDirectDemo,
});

function UserUpdateDirectDemo() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('1');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch user data
  const { data: user, isLoading, error: fetchError } = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUserDirect({ data: { id: userId } }),
  });

  // Update mutation with optimistic update
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      updateUserDirect({ data: { id: userId, data } }),

    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: userKeys.detail(userId) });
      const previousUser = queryClient.getQueryData(userKeys.detail(userId));
      queryClient.setQueryData(userKeys.detail(userId), (old: any) => ({
        ...old,
        ...newData,
      }));
      return { previousUser };
    },

    onError: (err, newData, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.detail(userId), context.previousUser);
      }
    },

    onSuccess: () => {
      setIsEditing(false);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
    },
  });

  // TanStack Form for edit form state + validation
  const form = useForm({
    defaultValues: { name: '', email: '' },
    onSubmit: async ({ value }) => {
      const updates: { name?: string; email?: string } = {};
      if (value.name !== user?.name) updates.name = value.name;
      if (value.email !== user?.email) updates.email = value.email;

      if (Object.keys(updates).length > 0) {
        updateMutation.mutate(updates);
      } else {
        setIsEditing(false);
      }
    },
  });

  // Sync form with user data when entering edit mode
  const handleStartEdit = () => {
    if (user) {
      form.setFieldValue('name', user.name);
      form.setFieldValue('email', user.email);
      setIsEditing(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">PUT User - Server → data-ops</h2>
        <p className="text-muted-foreground mt-1">
          Server function directly updates database via data-ops package
        </p>
      </div>

      {/* Data Flow Description */}
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
Server Function (user-application)
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
    │ 4. Drizzle ORM → SQL UPDATE
    │    (with email uniqueness check)
    │
    ▼
D1 Database → Updated user
    │
    │ 5. Success → Keep optimistic update
    │    Error → Rollback to previous state
    │
    ▼
Browser (UI reflects final state)`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Lowest latency (no extra hop)</li>
                <li>Full transaction control</li>
                <li>Optimistic updates work well</li>
                <li>Can combine multiple updates</li>
                <li>Direct Drizzle ORM access</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Logic not shared with data-service</li>
                <li>Requires D1 binding</li>
                <li>No automatic rate limiting</li>
                <li>Audit logging must be added</li>
                <li>Testing requires DB setup</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for app-specific mutations, performance-critical updates,
              complex transactions with rollback, and when optimistic updates 
              with guaranteed consistency are needed.
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded">
            <h4 className="font-semibold">Optimistic Updates</h4>
            <p className="text-sm mt-1">
              This demo uses optimistic updates: the UI updates immediately 
              before the server responds. If the server returns an error, 
              the UI automatically rolls back to the previous state.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo - Edit User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User ID Selector */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">User ID</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID"
              />
            </div>
          </div>

          {/* Error State */}
          {(fetchError || updateMutation.error) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {fetchError instanceof Error ? fetchError.message : 
                 updateMutation.error instanceof Error ? updateMutation.error.message :
                 'An error occurred'}
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {updateMutation.isSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>User updated successfully!</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading user...</span>
            </div>
          )}

          {/* User Data / Edit Form */}
          {user && (
            <div className="border rounded p-4 space-y-4">
              {isEditing ? (
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
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
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
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error as string} className="text-red-500 text-sm">{error}</p>
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
                      onClick={() => setIsEditing(false)}
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

          {/* Not Found State */}
          {!isLoading && !fetchError && !user && (
            <Alert>
              <AlertTitle>Not Found</AlertTitle>
              <AlertDescription>
                No user found with ID: {userId}
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
{`// useMutation for submission + optimistic updates
const updateMutation = useMutation({
  mutationFn: (data) => updateUserDirect({ data: { id, data } }),
  onMutate: async (newData) => {
    const previous = queryClient.getQueryData(userKeys.detail(id));
    queryClient.setQueryData(userKeys.detail(id), (old) => ({
      ...old, ...newData
    }));
    return { previous };
  },
  onError: (err, newData, ctx) => {
    queryClient.setQueryData(userKeys.detail(id), ctx.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
  },
});

// TanStack Form for validation + form state
const form = useForm({
  defaultValues: { name: '', email: '' },
  onSubmit: ({ value }) => {
    const updates = {};
    if (value.name !== user?.name) updates.name = value.name;
    if (value.email !== user?.email) updates.email = value.email;
    if (Object.keys(updates).length > 0) updateMutation.mutate(updates);
  },
});

// Field with client validation
<form.Field
  name="name"
  validators={{
    onChange: ({ value }) => !value ? 'Required' : undefined,
  }}
>
  {(field) => (
    <Input
      value={field.state.value}
      onChange={(e) => field.handleChange(e.target.value)}
    />
  )}
</form.Field>

// Button uses mutation.isPending
<Button disabled={!canSubmit || updateMutation.isPending}>
  {updateMutation.isPending ? 'Saving...' : 'Save'}
</Button>`}
          </pre>
        </CardContent>
      </Card>

      {/* Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Direct vs Binding Pattern Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Aspect</th>
                <th className="text-left p-2">Direct (This Pattern)</th>
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
                <td className="p-2 text-green-600">Full (Drizzle)</td>
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
                <td className="p-2 text-green-600">API handles it</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">Audit logging</td>
                <td className="p-2 text-orange-600">Must implement</td>
                <td className="p-2 text-green-600">Centralized in API</td>
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

1. **Ensure D1 binding is configured**

2. **Start user-application:**
   ```bash
   cd apps/user-application && pnpm dev
   ```

3. **Test the update flow:**
   - Navigate to `/demo/user-update-direct`
   - Enter a valid user ID
   - Click "Edit User"
   - Modify name/email
   - Click "Save"
   - Observe optimistic update (immediate UI change)

4. **Test error handling:**
   - Try updating with an email that already exists
   - Observe rollback on error

5. **Test authorization:**
   - Try updating a user you don't own (if not admin)
   - Should receive 403 error

## Related Patterns

- [005 - GET User (Server → data-ops)](./005-get-user-direct-dataops.md) - Same pattern for reads
- [006 - POST User (Server → Binding)](./006-post-user-service-binding.md) - Alternative via binding
- [008 - DELETE User (Server → data-ops)](./008-delete-user-direct-dataops.md) - Delete via direct data-ops
