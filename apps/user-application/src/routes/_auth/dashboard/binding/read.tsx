import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clientBindingQueries } from "@/lib/query-keys";

const searchSchema = z.object({
	clientId: z.string().optional(),
});

export const Route = createFileRoute("/_auth/dashboard/binding/read")({
	component: BindingReadPage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ clientId: search.clientId }),
	loader: async ({ context, deps }) => {
		if (deps.clientId) {
			await context.queryClient.ensureQueryData(clientBindingQueries.detail(deps.clientId));
		}
	},
});

function BindingReadPage() {
	const { clientId } = Route.useSearch();
	const navigate = useNavigate();

	const {
		data: client,
		isLoading,
		error,
		isFetching,
	} = useQuery({
		...clientBindingQueries.detail(clientId ?? ""),
		enabled: !!clientId,
		placeholderData: (prev) => prev,
	});

	const searchForm = useForm({
		defaultValues: { searchId: clientId ?? "" },
		onSubmit: ({ value }) => {
			if (value.searchId && value.searchId !== clientId) {
				navigate({ to: "/dashboard/binding/read", search: { clientId: value.searchId } });
			}
		},
	});

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
    │    queryClient.ensureQueryData(...)
    ▼
Server Function (getClientBinding)
    │
    │ 2. Zod validation
    ▼
env.DATA_SERVICE.fetch('https://data-service/clients/:id')
    │
    │ 3. Internal network call
    ▼
data-service (Hono API)
    │
    │ 4. authMiddleware → clientService.getClient()
    ▼
Response → React Query cache → Component`}
					</pre>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Read Client</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							searchForm.handleSubmit();
						}}
						className="flex gap-2"
					>
						<searchForm.Field name="searchId">
							{(field) => (
								<Input
									placeholder="Enter client ID (UUID)"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							)}
						</searchForm.Field>
						<Button type="submit" disabled={isFetching}>
							{isFetching ? "Loading..." : "Search"}
						</Button>
					</form>

					{error && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>
								{error instanceof Error ? error.message : "Failed to fetch client"}
							</AlertDescription>
						</Alert>
					)}

					{isLoading && (
						<div className="flex items-center gap-2">
							<div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
							<span>Loading...</span>
						</div>
					)}

					{client && (
						<div className="border rounded p-4">
							<div className="grid grid-cols-2 gap-2">
								<span className="text-muted-foreground">ID:</span>
								<span className="font-mono">{client.id}</span>
								<span className="text-muted-foreground">Name:</span>
								<span>{client.name}</span>
								<span className="text-muted-foreground">Surname:</span>
								<span>{client.surname}</span>
								<span className="text-muted-foreground">Email:</span>
								<span>{client.email}</span>
							</div>
						</div>
					)}

					{!isLoading && !error && !client && clientId && (
						<Alert>
							<AlertTitle>Not Found</AlertTitle>
							<AlertDescription>No client found with ID: {clientId}</AlertDescription>
						</Alert>
					)}

					{!clientId && (
						<Alert>
							<AlertTitle>Enter Client ID</AlertTitle>
							<AlertDescription>
								Enter a UUID from the List page to fetch client details
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Key Code</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`// core/functions/clients/binding.ts
export const getClientBinding = createServerFn()
  .inputValidator((data) => GetUserInput.parse(data))
  .handler(async (ctx) => {
    const response = await makeBindingRequest(\`/clients/\${ctx.data.id}\`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch client');
    return ClientSchema.parse(await response.json());
  });

// lib/query-keys.ts
export const clientBindingQueries.detail = (id) =>
  queryOptions({
    queryKey: clientKeys.detail(id, 'binding'),
    queryFn: () => getClientBinding({ data: { id } }),
  });`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
