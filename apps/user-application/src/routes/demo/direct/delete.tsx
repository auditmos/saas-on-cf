import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteUserDirect } from '@/core/functions/users/direct';
import { usersListDirectQueryOptions, userKeys } from '@/lib/query-keys';
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

export const Route = createFileRoute('/demo/direct/delete')({
  component: DirectDeletePage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(usersListDirectQueryOptions(pagination));
  },
});

function DirectDeletePage() {
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data, isLoading, error: fetchError } = useQuery({
    ...usersListDirectQueryOptions(pagination),
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

  const mutationError = deleteMutation.data && !deleteMutation.data.success ? deleteMutation.data.error : null;
  const userToDelete = data?.data.find((u) => u.id === deleteUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (Delete Button + Confirmation)
    │
    │ 1. Click Delete → show confirmation dialog
    ▼
useMutation → deleteUserDirect({ data: { id } })
    │
    │ 2. HTTP POST to server function
    ▼
Server Function (deleteUserDirect)
    │
    │ 3. Zod validation → existence check
    ▼
import { deleteUser } from '@repo/data-ops/queries/user'
    │
    │ 4. Direct Drizzle delete
    ▼
Response → Invalidate queries → UI refresh`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete User</CardTitle>
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
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>User deleted!</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading...</span>
            </div>
          )}

          {data && data.data.length === 0 && (
            <Alert>
              <AlertTitle>No Users</AlertTitle>
              <AlertDescription>No users found. Create some first.</AlertDescription>
            </Alert>
          )}

          {data && data.data.length > 0 && (
            <div className="border rounded">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Surname</th>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="p-2 font-mono text-sm">{user.id}</td>
                      <td className="p-2">{user.name}</td>
                      <td className="p-2">{user.surname}</td>
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
              Are you sure? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {userToDelete && (
            <div className="py-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Name:</span>
                <span>{userToDelete.name} {userToDelete.surname}</span>
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
          <CardTitle>Key Code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteUserDirect({ data: { id } }),
  onSuccess: (result) => {
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      setDeleteUserId(null);
    }
  },
});

// Confirmation gate
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
