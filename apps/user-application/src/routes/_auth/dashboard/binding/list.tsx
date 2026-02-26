import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientBindingQueries } from "@/lib/query-keys";

const paginationSchema = z.object({
	limit: z.number().default(5),
	offset: z.number().default(0),
});

export const Route = createFileRoute("/_auth/dashboard/binding/list")({
	component: BindingListPage,
	validateSearch: paginationSchema,
	loaderDeps: ({ search }) => ({ limit: search.limit, offset: search.offset }),
	loader: async ({ context, deps }) => {
		await context.queryClient.ensureQueryData(clientBindingQueries.list(deps));
	},
});

function BindingListPage() {
	const pagination = Route.useSearch();
	const navigate = useNavigate();

	const { data, isLoading, error, isFetching, refetch } = useQuery(
		clientBindingQueries.list(pagination),
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
Server Function (getClientsBinding)
    │
    │ 2. Zod validation
    ▼
env.DATA_SERVICE.fetch('https://data-service/clients?limit=5&offset=0')
    │
    │ 3. Internal network call
    ▼
data-service (Hono API)
    │
    │ 4. authMiddleware → zValidator → clientService.getClients()
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
												to: "/dashboard/binding/list",
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
												to: "/dashboard/binding/list",
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
						{`// core/functions/clients/binding.ts
export const getClientsBinding = createServerFn()
  .inputValidator((data) => PaginationRequestSchema.parse(data))
  .handler(async (ctx) => {
    const params = new URLSearchParams({
      limit: String(ctx.data.limit),
      offset: String(ctx.data.offset),
    });
    const response = await makeBindingRequest(\`/clients?\${params}\`);
    if (!response.ok) throw new Error('Failed to fetch clients');
    return ClientListResponseSchema.parse(await response.json());
  });

// lib/query-keys.ts
export const clientBindingQueries.list = (params) =>
  queryOptions({
    queryKey: clientKeys.list(params, 'binding'),
    queryFn: () => getClientsBinding({ data: params }),
  });`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
