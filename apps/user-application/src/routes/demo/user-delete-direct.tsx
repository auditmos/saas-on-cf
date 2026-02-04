import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteUserDirect } from '@/core/functions/user-mutations';
import { usersListDataOpsQueryOptions, userKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
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

const pagination = { limit: 10, offset: 0 };

export const Route = createFileRoute('/demo/user-delete-direct')({
  component: UserDeleteDirectDemo,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(usersListDataOpsQueryOptions(pagination));
  },
});

function UserDeleteDirectDemo() {
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data, isLoading, error: fetchError } = useQuery({
    ...usersListDataOpsQueryOptions(pagination),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserDirect({ data: { id } }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        setDeleteUserId(null);
      }
    },
  });

  const mutationError = deleteMutation.data && !deleteMutation.data.success
    ? deleteMutation.data.error
    : null;

  const userToDelete = data?.data.find((u) => u.id === deleteUserId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">DELETE User - Server → data-ops</h2>
        <p className="text-muted-foreground mt-1">
          Server function directly deletes via data-ops package
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (Delete Button + Confirmation)
    │
    │ 1. Click Delete → open confirmation dialog
    │
    ▼
useMutation → deleteUserDirect({ data: { id } })
    │
    │ 2. HTTP POST to server function
    │
    ▼
Server Function (deleteUserDirect)
    │
    │ 3. Zod validation → existence check
    │
    ▼
import { deleteUser } from '@repo/data-ops/queries/user'
    │
    │ 4. Direct function call (no network)
    │
    ▼
data-ops: deleteUser(id)
    │
    │ 5. Mock store removal
    │
    ▼
Response → Invalidate queries → UI updates`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700">✓ Pros</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Lowest latency (no extra hop)</li>
                <li>Full transaction control</li>
                <li>Can implement soft delete</li>
                <li>Cascade operations possible</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-700">✗ Cons</h4>
              <ul className="text-sm list-disc list-inside space-y-1 mt-2">
                <li>Logic not shared with data-service</li>
                <li>No automatic rate limiting</li>
                <li>Audit logging must be added</li>
              </ul>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-950 p-4 rounded">
            <h4 className="font-semibold">Safety Considerations</h4>
            <ul className="text-sm mt-1 list-disc list-inside">
              <li>Always show confirmation dialog before delete</li>
              <li>Consider soft delete for data recovery</li>
              <li>Log all delete operations in production</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Demo - Delete User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(fetchError || mutationError) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {fetchError instanceof Error ? fetchError.message : mutationError}
              </AlertDescription>
            </Alert>
          )}

          {deleteMutation.data?.success && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>User deleted successfully!</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading users...</span>
            </div>
          )}

          {data && data.data.length === 0 && (
            <Alert>
              <AlertTitle>No Users</AlertTitle>
              <AlertDescription>No users found. Create some users first.</AlertDescription>
            </Alert>
          )}

          {data && data.data.length > 0 && (
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
                          onClick={() => setDeleteUserId(user.id)}
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
        </CardContent>
      </Card>

      <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {userToDelete && (
            <div className="py-2">
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
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Key Implementation</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`// SSR with centralized query options
export const Route = createFileRoute('/demo/user-delete-direct')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      usersListDataOpsQueryOptions(pagination)
    );
  },
});

// Client - mutation with confirmation pattern
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteUserDirect({ data: { id } }),
  onSuccess: (result) => {
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      setDeleteUserId(null);
    }
  },
});

// Confirmation gate: state drives dialog open/close
<Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
  <Button onClick={() => deleteMutation.mutate(deleteUserId)}>
    Delete
  </Button>
</Dialog>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
