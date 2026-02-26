import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clientDirectQueries } from "@/lib/query-keys";

const searchSchema = z.object({
	clientId: z.string().optional(),
});

export const Route = createFileRoute("/_auth/dashboard/direct/read")({
	component: DirectReadPage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ clientId: search.clientId }),
	loader: async ({ context, deps }) => {
		if (deps.clientId) {
			await context.queryClient.ensureQueryData(clientDirectQueries.detail(deps.clientId));
		}
	},
});

function DirectReadPage() {
	const { clientId } = Route.useSearch();
	const navigate = useNavigate();

	const {
		data: client,
		isLoading,
		error,
		isFetching,
	} = useQuery({
		...clientDirectQueries.detail(clientId ?? ""),
		enabled: !!clientId,
		placeholderData: (prev) => prev,
	});

	const searchForm = useForm({
		defaultValues: { searchId: clientId ?? "" },
		onSubmit: ({ value }) => {
			if (value.searchId && value.searchId !== clientId) {
				navigate({ to: "/dashboard/direct/read", search: { clientId: value.searchId } });
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
Server Function (getClientDirect)
    │
    │ 2. Zod validation
    ▼
import { getClient } from '@repo/data-ops/client'
    │
    │ 3. Direct Drizzle query
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
						{`// Route with SSR + URL params
const searchSchema = z.object({ clientId: z.string().default('1') });

export const Route = createFileRoute('/_auth/dashboard/direct/read')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ clientId: search.clientId }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      clientDirectQueries.detail(deps.clientId)
    );
  },
});

// Component uses cached data
const { data: client } = useQuery({
  ...clientDirectQueries.detail(clientId),
  placeholderData: (prev) => prev,
});`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
