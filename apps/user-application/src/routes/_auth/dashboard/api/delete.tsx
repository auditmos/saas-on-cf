import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { AppError } from "@/core/errors";
import { deleteClientApi, fetchClients } from "@/lib/api-client";
import { clientKeys } from "@/lib/query-keys";

const pagination = { limit: 10, offset: 0 };

export const Route = createFileRoute("/_auth/dashboard/api/delete")({
	component: ApiDeletePage,
});

function ApiDeletePage() {
	const queryClient = useQueryClient();
	const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

	const {
		data,
		isLoading,
		error: fetchError,
		refetch,
	} = useQuery({
		queryKey: clientKeys.list(pagination, "api"),
		queryFn: () => fetchClients(pagination),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteClientApi(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
			setDeleteClientId(null);
		},
	});

	const clientToDelete = data?.data.find((u) => u.id === deleteClientId);

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
fetch('${import.meta.env.VITE_DATA_SERVICE_URL || "http://localhost:8788"}/clients/:id', {
  method: 'DELETE'
})
    │
    │ 2. HTTP DELETE (crosses public internet)
    ▼
data-service (Hono API)
    │
    │ 3. CORS check → authMiddleware → clientService.deleteClient()
    ▼
Response → Invalidate queries → UI refresh`}
					</pre>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Delete Client</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{fetchError && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>
								{fetchError instanceof AppError
									? `${fetchError.message} (${fetchError.status})`
									: "Failed to fetch clients. Is data-service running?"}
							</AlertDescription>
						</Alert>
					)}

					{deleteMutation.isError && (
						<Alert variant="destructive">
							<AlertTitle>Delete Error</AlertTitle>
							<AlertDescription>
								{deleteMutation.error instanceof Error
									? deleteMutation.error.message
									: "Failed to delete"}
							</AlertDescription>
						</Alert>
					)}

					{deleteMutation.isSuccess && (
						<Alert variant="success">
							<AlertTitle>Success</AlertTitle>
							<AlertDescription>Client deleted!</AlertDescription>
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
							<AlertTitle>No Clients</AlertTitle>
							<AlertDescription>No clients found. Create some first.</AlertDescription>
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
									{data.data.map((client) => (
										<tr key={client.id} className="border-t">
											<td className="p-2 font-mono text-sm">{client.id}</td>
											<td className="p-2">{client.name}</td>
											<td className="p-2">{client.surname}</td>
											<td className="p-2">{client.email}</td>
											<td className="p-2">
												<Button
													variant="destructive"
													size="sm"
													onClick={() => {
														deleteMutation.reset();
														setDeleteClientId(client.id);
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

			<Dialog open={!!deleteClientId} onOpenChange={() => setDeleteClientId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Delete</DialogTitle>
						<DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
					</DialogHeader>

					{clientToDelete && (
						<div className="py-2 text-sm">
							<div className="grid grid-cols-2 gap-2">
								<span className="text-muted-foreground">Name:</span>
								<span>
									{clientToDelete.name} {clientToDelete.surname}
								</span>
								<span className="text-muted-foreground">Email:</span>
								<span>{clientToDelete.email}</span>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteClientId(null)}
							disabled={deleteMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => deleteClientId && deleteMutation.mutate(deleteClientId)}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
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
export async function deleteClientApi(id: string): Promise<void> {
  const response = await fetch(\`\${API_URL}/clients/\${id}\`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new ApiError(errorData.message || 'Failed to delete', response.status);
  }
}

// Component
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteClientApi(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    setDeleteClientId(null);
  },
});`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
