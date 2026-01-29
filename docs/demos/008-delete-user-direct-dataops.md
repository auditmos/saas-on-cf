# Demo: DELETE User - Server Function → data-ops (Direct Delete)

## Overview

This demo showcases **Pattern C for deletions**: a server function directly calls `data-ops` to delete data, bypassing `data-service`. This pattern is ideal for app-specific delete logic with cascade operations.

**Note:** Currently uses mocks that mirror the future Neon database interface. When migrating to Neon, only the internal implementation changes - the interface stays the same.

## Data Flow Diagram

```
┌──────────────────┐
│     Browser      │
│  (React Client)  │
│                  │
│  Delete Button   │
│  + Confirmation  │
└────────┬─────────┘
         │
         │ 1. Button click → useMutation
         │
         ▼
┌──────────────────────────────────────┐
│        user-application              │
│        (Server Function)             │
│                                      │
│  • Auth middleware (session check)   │
│  • Input validation (user ID)        │
│  • Authorization (admin or owner)    │
│  • Self-delete prevention            │
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
│  deleteUser(id)                      │
│  - Existence check                   │
│  - Cascade logic (optional)          │
│  - Soft delete (optional)            │
└────────┬─────────────────────────────┘
         │
         │ 3. SQL DELETE query
         │
         ▼
┌──────────────────┐
│   D1 Database    │
└────────┬─────────┘
         │
         │ 4. Returns success
         │
         ▼
┌──────────────────┐
│     Browser      │
│  Query cache     │
│  invalidated     │
└──────────────────┘
```

## When to Use This Pattern

**Good fit:**
- App-specific delete logic
- Soft delete requirements
- Cascade operations (delete related records)
- When you need transaction guarantees
- Delete with undo capability

**Avoid when:**
- Same delete logic needed by external clients
- Delete needs data-service audit logging
- API rate limiting is important

## Pros and Cons

| Pros | Cons |
|------|------|
| Lowest latency | Logic not shared with data-service |
| Full transaction control | Requires D1 binding |
| Can implement soft delete | No automatic rate limiting |
| Cascade operations | Audit logging must be added |
| Undo capability | Testing requires DB setup |

## Prerequisites

### 1. Mock-Based Query Interface

The `deleteUser` function is defined in `packages/data-ops/src/queries/user.ts`:

```typescript
import { mockUsers } from '../mocks/user-mock';

/**
 * Delete user - uses mock store (will use Neon later)
 */
export async function deleteUser(userId: string): Promise<boolean> {
  // Check if user exists
  const user = mockUsers.findById(userId);
  if (!user) {
    return false;
  }
  
  // Delete from mock store
  mockUsers.delete(userId);
  return true;
}
```

### 2. Future Migration to Neon

When ready to use Neon database:

```typescript
// Future: Hard delete
export async function deleteUser(userId: string): Promise<boolean> {
  const db = getDb();
  
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  
  return !!deleted;
}

// Future: Soft delete
export async function softDeleteUser(userId: string): Promise<boolean> {
  const db = getDb();
  
  const [updated] = await db
    .update(users)
    .set({
      deletedAt: new Date(),
      email: `deleted_${Date.now()}_${userId}@deleted.local`,
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  
  return !!updated;
}

// Future: With cascade (transaction)
export async function deleteUserWithCascade(userId: string): Promise<boolean> {
  const db = getDb();
  
  await db.transaction(async (tx) => {
    // Delete related records first
    // await tx.delete(userSessions).where(eq(userSessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
  
  return true;
}
```

The interface stays the same - only internal implementation changes.

## Implementation Steps

### Step 1: Create Server Function for Delete

```typescript
// apps/user-application/src/core/functions/user-mutations.ts (add to existing)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { deleteUser, getUser } from '@repo/data-ops/queries/user';
import { protectedFunctionMiddleware } from '@/core/middleware/auth';

// Input schema for delete
const DeleteUserInput = z.object({
  id: z.string().min(1, 'User ID is required'),
});

type DeleteUserInputType = z.infer<typeof DeleteUserInput>;

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
 * Delete user - Direct data-ops mutation
 * 
 * Data Flow: Browser → Server Function → data-ops → D1 → Response
 * 
 * Features:
 * - Auth middleware ensures user is logged in
 * - Authorization check (admin only or self)
 * - Self-delete prevention for safety
 */
export const deleteUserDirect = createServerFn({ method: 'POST' })
  .middleware([protectedFunctionMiddleware])
  .validator((data: unknown): DeleteUserInputType => {
    return DeleteUserInput.parse(data);
  })
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { id } = data;
    const { session } = context;
    
    // Check if user exists
    const targetUser = await getUser(id);
    if (!targetUser) {
      throw new MutationError('User not found', 'NOT_FOUND', 404);
    }
    
    // Authorization: Only admin can delete others
    const isAdmin = session.user.role === 'admin';
    const isSelf = targetUser.id === session.user.id;
    
    if (!isAdmin && !isSelf) {
      throw new MutationError(
        'Only admins can delete other users',
        'FORBIDDEN',
        403
      );
    }
    
    // Safety: Prevent self-deletion (optional)
    if (isSelf) {
      throw new MutationError(
        'Cannot delete your own account. Contact support.',
        'SELF_DELETE_FORBIDDEN',
        400
      );
    }
    
    // Direct call to data-ops deletion
    const deleted = await deleteUser(id);
    
    if (!deleted) {
      throw new MutationError('Failed to delete user', 'DELETE_FAILED', 500);
    }
    
    return { success: true };
  });
```

### Step 2: Create Demo Route

```tsx
// apps/user-application/src/routes/demo/user-delete-direct.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchUsers } from '@/lib/api-client';
import { deleteUserDirect } from '@/core/functions/user-mutations';
import { userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const Route = createFileRoute('/demo/user-delete-direct')({
  component: UserDeleteDirectDemo,
});

function UserDeleteDirectDemo() {
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [pagination] = useState({ limit: 10, offset: 0 });

  // Fetch users list
  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: userKeys.list(pagination),
    queryFn: () => fetchUsers(pagination),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserDirect({ data: { id } }),
    
    onSuccess: () => {
      // Invalidate user lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      // Close dialog
      setDeleteUserId(null);
    },
  });

  const handleDeleteClick = (userId: string) => {
    setDeleteUserId(userId);
  };

  const handleConfirmDelete = () => {
    if (deleteUserId) {
      deleteMutation.mutate(deleteUserId);
    }
  };

  const userToDelete = data?.data.find((u) => u.id === deleteUserId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">DELETE User - Server → data-ops</h2>
        <p className="text-muted-foreground mt-1">
          Server function directly deletes from database via data-ops package
        </p>
      </div>

      {/* Data Flow Description */}
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (Delete Button)
    │
    │ 1. Click → Confirmation dialog
    │
    ▼
useMutation → deleteUserDirect({ data: { id } })
    │
    │ 2. HTTP POST to server function
    │
    ▼
Server Function (user-application)
    │
    │ 3. Auth check → Authorization → Self-delete prevention
    │
    ▼
import { deleteUser } from '@repo/data-ops/queries/user'
    │
    │ 4. Direct function call (no network)
    │
    ▼
data-ops: deleteUser(id)
    │
    │ 5. Existence check → SQL DELETE
    │
    ▼
D1 Database → Success
    │
    │ 6. Invalidate queries → UI updates
    │
    ▼
Browser (User removed from list)`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Lowest latency</li>
                <li>Full transaction control</li>
                <li>Can implement soft delete</li>
                <li>Cascade operations</li>
                <li>Undo capability possible</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Logic not shared with data-service</li>
                <li>Requires D1 binding</li>
                <li>No automatic rate limiting</li>
                <li>Audit logging must be added</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">
              Best for app-specific delete logic, soft delete requirements,
              cascade operations, and when you need transaction guarantees.
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-950 p-4 rounded">
            <h4 className="font-semibold">Safety Considerations</h4>
            <ul className="text-sm mt-1 list-disc list-inside">
              <li>Always show confirmation dialog</li>
              <li>Prevent self-deletion</li>
              <li>Consider soft delete for recovery</li>
              <li>Log all delete operations</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo - Delete User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error State */}
          {(fetchError || deleteMutation.error) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {fetchError instanceof Error ? fetchError.message :
                 deleteMutation.error instanceof Error ? deleteMutation.error.message :
                 'An error occurred'}
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {deleteMutation.isSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>User deleted successfully!</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading users...</span>
            </div>
          )}

          {/* Users List */}
          {data && (
            <div className="border rounded">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="p-2 font-mono text-sm">{user.id}</td>
                      <td className="p-2">{user.name}</td>
                      <td className="p-2">{user.email}</td>
                      <td className="p-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(user.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {data && data.data.length === 0 && (
            <Alert>
              <AlertTitle>No Users</AlertTitle>
              <AlertDescription>
                No users found. Create some users first.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {userToDelete && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span>{userToDelete.name}</span>
                <span className="text-muted-foreground">Email:</span>
                <span>{userToDelete.email}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteUserId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Code Example */}
      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// Server Function with authorization
export const deleteUserDirect = createServerFn({ method: 'POST' })
  .middleware([protectedFunctionMiddleware])
  .validator((data) => DeleteUserInput.parse(data))
  .handler(async ({ data, context }) => {
    const { session } = context;
    
    // Authorization check
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && targetUser.id !== session.user.id) {
      throw new MutationError('Forbidden', 'FORBIDDEN', 403);
    }
    
    // Safety: Prevent self-deletion
    if (targetUser.id === session.user.id) {
      throw new MutationError('Cannot delete yourself', 'SELF_DELETE', 400);
    }
    
    // Direct deletion
    await deleteUser(data.id);
    return { success: true };
  });

// Delete mutation with confirmation
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteUserDirect({ data: { id } }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.lists() });
  },
});

// Confirmation dialog pattern
<Dialog open={!!deleteUserId}>
  <DialogContent>
    <DialogTitle>Confirm Delete</DialogTitle>
    <DialogFooter>
      <Button variant="destructive" onClick={handleConfirmDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
          </pre>
        </CardContent>
      </Card>

      {/* Soft Delete Alternative */}
      <Card>
        <CardHeader>
          <CardTitle>Alternative: Soft Delete Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Instead of hard delete, you can implement soft delete for data recovery:
          </p>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// data-ops: Soft delete function
export async function softDeleteUser(userId: string): Promise<boolean> {
  const db = getDb();
  
  const [updated] = await db
    .update(auth_user)
    .set({
      deletedAt: new Date(),
      // Prevent email conflicts for new accounts
      email: \`deleted_\${Date.now()}_\${userId}@deleted.local\`,
    })
    .where(eq(auth_user.id, userId))
    .returning({ id: auth_user.id });
  
  return !!updated;
}

// Query excludes soft-deleted users
export async function getActiveUsers() {
  return db
    .select()
    .from(auth_user)
    .where(isNull(auth_user.deletedAt));
}

// Restore function
export async function restoreUser(userId: string, originalEmail: string) {
  return db
    .update(auth_user)
    .set({
      deletedAt: null,
      email: originalEmail,
    })
    .where(eq(auth_user.id, userId));
}`}
          </pre>
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
   Open `http://localhost:5173/demo/user-delete-direct`

3. **Test delete flow:**
   - Click "Delete" on a user row
   - Observe confirmation dialog
   - Click "Delete" in dialog
   - User should disappear from list

4. **Test authorization:**
   - Try deleting when not admin (should fail)
   - Check error message in UI

5. **Test self-delete prevention:**
   - Try deleting your own user
   - Should see "Cannot delete your own account" error

## Related Patterns

- [005 - GET User (Server → data-ops)](./005-get-user-direct-dataops.md) - Read via direct data-ops
- [007 - PUT User (Server → data-ops)](./007-put-user-direct-dataops.md) - Update via direct data-ops
- [006 - POST User (Server → Binding)](./006-post-user-service-binding.md) - Write via binding (alternative)
