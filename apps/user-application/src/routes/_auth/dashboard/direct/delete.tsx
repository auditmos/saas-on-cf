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
import { deleteClientDirect } from "@/core/functions/clients/direct";
import { clientDirectQueries, clientKeys } from "@/lib/query-keys";

const pagination = { limit: 10, offset: 0 };

export const Route = createFileRoute("/_auth/dashboard/direct/delete")({
	component: DirectDeletePage,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(clientDirectQueries.list(pagination));
	},
});

function DirectDeletePage() {
	const queryClient = useQueryClient();
	const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

	const {
		data,
		isLoading,
		error: fetchError,
	} = useQuery({
		...clientDirectQueries.list(pagination),
		placeholderData: (prev) => prev,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteClientDirect({ data: { id } }),
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
useMutation → deleteClientDirect({ data: { id } })
    │
    │ 2. HTTP POST to server function
    ▼
Server Function (deleteClientDirect)
    │
    │ 3. Zod validation → existence check
    ▼
import { deleteClient } from '@repo/data-ops/client'
    │
    │ 4. Direct Drizzle delete
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
							<AlertDescription>{fetchError.message}</AlertDescription>
						</Alert>
					)}

					{deleteMutation.isError && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{deleteMutation.error.message}</AlertDescription>
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
													onClick={() => setDeleteClientId(client.id)}
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
						{`const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteClientDirect({ data: { id } }),
  onSuccess: (result) => {
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      setDeleteClientId(null);
    }
  },
});

// Confirmation gate
<Dialog open={!!deleteClientId} onOpenChange={() => setDeleteClientId(null)}>
  <Button onClick={() => deleteMutation.mutate(deleteClientId)}>
    Delete
  </Button>
</Dialog>`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
