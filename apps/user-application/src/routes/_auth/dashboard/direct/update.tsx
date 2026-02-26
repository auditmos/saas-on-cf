import type { Client } from "@repo/data-ops/client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateClientDirect } from "@/core/functions/clients/direct";
import { clientDirectQueries, clientKeys } from "@/lib/query-keys";

const searchSchema = z.object({
	clientId: z.string().optional(),
	editing: z.boolean().default(false),
});

export const Route = createFileRoute("/_auth/dashboard/direct/update")({
	component: DirectUpdatePage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ clientId: search.clientId }),
	loader: async ({ context, deps }) => {
		if (deps.clientId) {
			await context.queryClient.ensureQueryData(clientDirectQueries.detail(deps.clientId));
		}
	},
});

function DirectUpdatePage() {
	const { clientId, editing } = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const {
		data: client,
		isLoading,
		error: fetchError,
		isFetching,
	} = useQuery({
		...clientDirectQueries.detail(clientId ?? ""),
		enabled: !!clientId,
		placeholderData: (prev) => prev,
	});

	const updateMutation = useMutation({
		mutationFn: (data: { name?: string; surname?: string; email?: string }) =>
			updateClientDirect({ data: { id: clientId!, data } }),

		onMutate: async (newData) => {
			await queryClient.cancelQueries({ queryKey: clientKeys.detail(clientId!, "direct") });
			const previousClient = queryClient.getQueryData<Client | null>(
				clientKeys.detail(clientId!, "direct"),
			);
			queryClient.setQueryData<Client | null>(clientKeys.detail(clientId!, "direct"), (old) =>
				old ? { ...old, ...newData } : old,
			);
			return { previousClient };
		},

		onError: (_err, _newData, context) => {
			if (context?.previousClient) {
				queryClient.setQueryData(clientKeys.detail(clientId!, "direct"), context.previousClient);
			}
		},

		onSuccess: () => {
			navigate({ to: "/dashboard/direct/update", search: { clientId, editing: false } });
		},

		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId!, "direct") });
		},
	});

	const form = useForm({
		defaultValues: {
			name: client?.name ?? "",
			surname: client?.surname ?? "",
			email: client?.email ?? "",
		},
		onSubmit: async ({ value }) => {
			const updates: { name?: string; surname?: string; email?: string } = {};
			if (value.name !== client?.name) updates.name = value.name;
			if (value.surname !== client?.surname) updates.surname = value.surname;
			if (value.email !== client?.email) updates.email = value.email;

			if (Object.keys(updates).length > 0) {
				updateMutation.mutate(updates);
			} else {
				navigate({ to: "/dashboard/direct/update", search: { clientId, editing: false } });
			}
		},
	});

	const searchForm = useForm({
		defaultValues: { searchId: clientId ?? "" },
		onSubmit: ({ value }) => {
			if (value.searchId && value.searchId !== clientId) {
				navigate({
					to: "/dashboard/direct/update",
					search: { clientId: value.searchId, editing: false },
				});
			}
		},
	});

	const handleStartEdit = () => {
		if (client) {
			form.setFieldValue("name", client.name);
			form.setFieldValue("surname", client.surname);
			form.setFieldValue("email", client.email);
			navigate({ to: "/dashboard/direct/update", search: { clientId, editing: true } });
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Data Flow</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`Browser (TanStack Form + useMutation)
    │
    │ 1. Form submit → mutation.mutate()
    │    + Optimistic update to cache
    ▼
Server Function (updateClientDirect)
    │
    │ 2. Zod validation → existence check
    ▼
import { updateClient } from '@repo/data-ops/client'
    │
    │ 3. Direct Drizzle update
    ▼
Response → Success: keep optimistic
         → Error: rollback cache`}
					</pre>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Update Client</CardTitle>
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

					{fetchError && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{fetchError.message}</AlertDescription>
						</Alert>
					)}

					{updateMutation.isError && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{updateMutation.error.message}</AlertDescription>
						</Alert>
					)}

					{updateMutation.isSuccess && (
						<Alert variant="success">
							<AlertTitle>Success</AlertTitle>
							<AlertDescription>Client updated!</AlertDescription>
						</Alert>
					)}

					{isLoading && (
						<div className="flex items-center gap-2">
							<div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
							<span>Loading...</span>
						</div>
					)}

					{client && (
						<div className="border rounded p-4 space-y-4">
							{editing ? (
								<form
									onSubmit={(e) => {
										e.preventDefault();
										form.handleSubmit();
									}}
									className="space-y-4"
								>
									<form.Field
										name="name"
										validators={{ onChange: ({ value }) => (!value ? "Required" : undefined) }}
									>
										{(field) => (
											<div className="space-y-1">
												<label className="text-sm font-medium">Name</label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
												/>
												{field.state.meta.errors.map((err) => (
													<p key={String(err)} className="text-destructive text-sm">
														{err}
													</p>
												))}
											</div>
										)}
									</form.Field>

									<form.Field
										name="surname"
										validators={{ onChange: ({ value }) => (!value ? "Required" : undefined) }}
									>
										{(field) => (
											<div className="space-y-1">
												<label className="text-sm font-medium">Surname</label>
												<Input
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
												/>
												{field.state.meta.errors.map((err) => (
													<p key={String(err)} className="text-destructive text-sm">
														{err}
													</p>
												))}
											</div>
										)}
									</form.Field>

									<form.Field
										name="email"
										validators={{
											onChange: ({ value }) => {
												if (!value) return "Required";
												if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email";
											},
										}}
									>
										{(field) => (
											<div className="space-y-1">
												<label className="text-sm font-medium">Email</label>
												<Input
													type="email"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
												/>
												{field.state.meta.errors.map((err) => (
													<p key={String(err)} className="text-destructive text-sm">
														{err}
													</p>
												))}
											</div>
										)}
									</form.Field>

									<div className="flex gap-2">
										<form.Subscribe selector={(state) => state.canSubmit}>
											{(canSubmit) => (
												<Button type="submit" disabled={!canSubmit || updateMutation.isPending}>
													{updateMutation.isPending ? "Saving..." : "Save"}
												</Button>
											)}
										</form.Subscribe>
										<Button
											type="button"
											variant="outline"
											onClick={() =>
												navigate({
													to: "/dashboard/direct/update",
													search: { clientId, editing: false },
												})
											}
											disabled={updateMutation.isPending}
										>
											Cancel
										</Button>
									</div>
								</form>
							) : (
								<>
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
									<Button onClick={handleStartEdit}>Edit</Button>
								</>
							)}
						</div>
					)}

					{!isLoading && !fetchError && !client && clientId && (
						<Alert>
							<AlertTitle>Not Found</AlertTitle>
							<AlertDescription>No client found with ID: {clientId}</AlertDescription>
						</Alert>
					)}

					{!clientId && (
						<Alert>
							<AlertTitle>Enter Client ID</AlertTitle>
							<AlertDescription>
								Enter a UUID from the List page to update a client
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Key Code - Optimistic Updates</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`const updateMutation = useMutation({
  mutationFn: (data) => updateClientDirect({ data: { id: clientId, data } }),
  onMutate: async (newData) => {
    const previous = queryClient.getQueryData(clientKeys.detail(clientId, 'direct'));
    queryClient.setQueryData(clientKeys.detail(clientId, 'direct'), (old) => ({
      ...old, ...newData
    }));
    return { previous };
  },
  onError: (err, newData, ctx) => {
    queryClient.setQueryData(clientKeys.detail(clientId, 'direct'), ctx.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId, 'direct') });
  },
});`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
