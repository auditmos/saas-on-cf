import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientDirectQueries } from "@/lib/query-keys";

const paginationSchema = z.object({
	limit: z.number().default(5),
	offset: z.number().default(0),
});

export const Route = createFileRoute("/_auth/dashboard/direct/list")({
	component: DirectListPage,
	validateSearch: paginationSchema,
	loaderDeps: ({ search }) => ({ limit: search.limit, offset: search.offset }),
	loader: async ({ context, deps }) => {
		await context.queryClient.ensureQueryData(clientDirectQueries.list(deps));
	},
});

function DirectListPage() {
	const pagination = Route.useSearch();
	const navigate = useNavigate();

	const { data, isLoading, error, isFetching, refetch } = useQuery(
		clientDirectQueries.list(pagination),
	);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Data Flow</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`Browser Navigation
    │
    │ 1. Route loader runs (SSR)
    ▼
Server Function (getClientsDirect)
    │
    │ 2. Zod validation (PaginationRequestSchema)
    ▼
import { getClients } from '@repo/data-ops/client'
    │
    │ 3. Drizzle query with limit/offset + count
    ▼
Response → React Query cache → Table render`}
					</pre>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Clients List</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>
								{error instanceof Error ? error.message : "Failed to fetch clients"}
							</AlertDescription>
						</Alert>
					)}

					{isLoading && (
						<div className="flex items-center gap-2">
							<div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
							<span>Loading...</span>
						</div>
					)}

					{data && (
						<>
							<div className="border rounded">
								<table className="w-full">
									<thead className="bg-muted">
										<tr>
											<th className="text-left p-2">ID</th>
											<th className="text-left p-2">Name</th>
											<th className="text-left p-2">Surname</th>
											<th className="text-left p-2">Email</th>
										</tr>
									</thead>
									<tbody>
										{data.data.map((client) => (
											<tr key={client.id} className="border-t">
												<td className="p-2 font-mono text-sm">{client.id}</td>
												<td className="p-2">{client.name}</td>
												<td className="p-2">{client.surname}</td>
												<td className="p-2">{client.email}</td>
											</tr>
										))}
										{data.data.length === 0 && (
											<tr>
												<td colSpan={4} className="p-4 text-center text-muted-foreground">
													No clients found
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									Showing {pagination.offset + 1} - {pagination.offset + data.data.length} of{" "}
									{data.pagination.total}
								</span>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={pagination.offset === 0}
										onClick={() =>
											navigate({
												to: "/dashboard/direct/list",
												search: {
													...pagination,
													offset: Math.max(0, pagination.offset - pagination.limit),
												},
											})
										}
									>
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={!data.pagination.hasMore}
										onClick={() =>
											navigate({
												to: "/dashboard/direct/list",
												search: { ...pagination, offset: pagination.offset + pagination.limit },
											})
										}
									>
										Next
									</Button>
								</div>
							</div>
						</>
					)}

					<Button onClick={() => refetch()} disabled={isFetching}>
						{isFetching ? "Refetching..." : "Refetch"}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Key Code</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`// lib/query-keys.ts
export const clientDirectQueries.list = (params) =>
  queryOptions({
    queryKey: clientKeys.list(params, 'direct'),
    queryFn: () => getClientsDirect({ data: params }),
    placeholderData: (prev) => prev,
  });

// Route with SSR
export const Route = createFileRoute('/_auth/dashboard/direct/list')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      clientDirectQueries.list(defaultPagination)
    );
  },
});`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
