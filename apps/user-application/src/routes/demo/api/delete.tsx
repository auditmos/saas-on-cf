import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchUsers, deleteUserApi, ApiError } from '@/lib/api-client';
import { userKeys } from '@/lib/query-keys';
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

export const Route = createFileRoute('/demo/api/delete')({
  component: ApiDeletePage,
});

function ApiDeletePage() {
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, isLoading, error: fetchError, refetch } = useQuery({
    queryKey: userKeys.list(pagination, 'api'),
    queryFn: () => fetchUsers(pagination),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      setSuccessMessage('User deleted!');
      setDeleteUserId(null);
    },
  });

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
fetch('${import.meta.env.VITE_DATA_SERVICE_URL || 'http://localhost:8788'}/users/:id', {
  method: 'DELETE'
})
    │
    │ 2. HTTP DELETE (crosses public internet)
    ▼
data-service (Hono API)
    │
    │ 3. CORS check → authMiddleware → userService.deleteUser()
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
          {fetchError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {fetchError instanceof ApiError
                  ? `${fetchError.message} (${fetchError.status})`
                  : 'Failed to fetch users. Is data-service running?'}
              </AlertDescription>
            </Alert>
          )}

          {deleteMutation.isError && (
            <Alert variant="destructive">
              <AlertTitle>Delete Error</AlertTitle>
              <AlertDescription>
                {deleteMutation.error instanceof ApiError
                  ? `${deleteMutation.error.message} (${deleteMutation.error.status})`
                  : deleteMutation.error instanceof Error
                    ? deleteMutation.error.message
                    : 'Failed to delete'}
              </AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
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
                          onClick={() => {
                            setSuccessMessage(null);
                            setDeleteUserId(user.id);
                          }}
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

          <Button onClick={() => refetch()} variant="outline">
            Refetch
          </Button>
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
{`// lib/api-client.ts
export async function deleteUserApi(id: string): Promise<void> {
  const response = await fetch(\`\${API_URL}/users/\${id}\`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new ApiError(errorData.message || 'Failed to delete', response.status);
  }
}

// Component
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteUserApi(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    setDeleteUserId(null);
  },
});`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
