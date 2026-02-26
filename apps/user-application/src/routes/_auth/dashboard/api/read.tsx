import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppError } from "@/core/errors";
import { clientApiQueries } from "@/lib/query-keys";

const searchSchema = z.object({
	clientId: z.string().optional(),
});

export const Route = createFileRoute("/_auth/dashboard/api/read")({
	component: ApiReadPage,
	validateSearch: searchSchema,
});

function ApiReadPage() {
	const { clientId } = Route.useSearch();
	const navigate = useNavigate();

	const {
		data: client,
		isLoading,
		error,
		isFetching,
		refetch,
	} = useQuery({
		...clientApiQueries.detail(clientId ?? ""),
		enabled: !!clientId,
	});

	const searchForm = useForm({
		defaultValues: { searchId: clientId ?? "" },
		onSubmit: ({ value }) => {
			if (value.searchId && value.searchId !== clientId) {
				navigate({ to: "/dashboard/api/read", search: { clientId: value.searchId } });
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
						{`Browser (React)
    │
    │ 1. useQuery calls fetchClient(id)
    ▼
fetch('${import.meta.env.VITE_DATA_SERVICE_URL || "http://localhost:8788"}/clients/:id')
    │
    │ 2. HTTP GET (crosses public internet)
    ▼
data-service (Hono API)
    │
    │ 3. CORS check → authMiddleware → clientService.getClient()
    ▼
Response → React Query cache → Component

Note: No SSR - client sees loading state on initial render`}
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
								{error instanceof AppError
									? `${error.message} (${error.status})`
									: error instanceof Error
										? error.message
										: "Failed to fetch client"}
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

					<Button onClick={() => refetch()} disabled={isFetching || !clientId} variant="outline">
						Refetch
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Key Code</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`// Route with search params (no SSR loader for API pattern)
const searchSchema = z.object({ clientId: z.string().optional() });

export const Route = createFileRoute('/_auth/dashboard/api/read')({
  validateSearch: searchSchema,
});

// Component - URL-driven state, no SSR
const { clientId } = Route.useSearch();
const navigate = useNavigate();

const { data: client } = useQuery({
  ...clientApiQueries.detail(clientId ?? ''),
  enabled: !!clientId,
});

// Navigate updates URL search params
const handleSearch = (newId: string) => {
  navigate({ to: '/dashboard/api/read', search: { clientId: newId } });
};`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
