import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClientBinding } from "@/core/functions/clients/binding";
import { clientKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/_auth/dashboard/binding/create")({
	component: BindingCreatePage,
});

function BindingCreatePage() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (data: { name: string; surname: string; email: string }) =>
			createClientBinding({ data }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: clientKeys.all });
			form.reset();
		},
	});

	const form = useForm({
		defaultValues: { name: "", surname: "", email: "" },
		onSubmit: async ({ value }) => {
			mutation.reset();
			mutation.mutate(value);
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
						{`Browser (TanStack Form)
    │
    │ 1. Client validation → mutation.mutate()
    ▼
Server Function (createClientBinding)
    │
    │ 2. Zod validation
    ▼
env.DATA_SERVICE.fetch('https://data-service/clients', {
  method: 'POST',
  headers: { Authorization: 'Bearer <token>' },
  body: JSON.stringify(data)
})
    │
    │ 3. Internal network call (no CORS)
    ▼
data-service (Hono API)
    │
    │ 4. authMiddleware → zValidator → clientService.createClient()
    ▼
Response → queryClient.invalidateQueries()`}
					</pre>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Create Client</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{mutation.isSuccess && (
						<Alert variant="success">
							<AlertTitle>Success</AlertTitle>
							<AlertDescription>
								Client "{mutation.data.name}" created (ID: {mutation.data.id})
							</AlertDescription>
						</Alert>
					)}

					{mutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>{mutation.error.message}</AlertDescription>
						</Alert>
					)}

					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
						<form.Field
							name="name"
							validators={{
								onChange: ({ value }) => (!value ? "Name is required" : undefined),
							}}
						>
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className="text-sm font-medium">
										Name
									</label>
									<Input
										id={field.name}
										placeholder="John"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.map((error) => (
										<p key={String(error)} className="text-destructive text-sm">
											{error}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Field
							name="surname"
							validators={{
								onChange: ({ value }) => (!value ? "Surname is required" : undefined),
							}}
						>
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className="text-sm font-medium">
										Surname
									</label>
									<Input
										id={field.name}
										placeholder="Doe"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.map((error) => (
										<p key={String(error)} className="text-destructive text-sm">
											{error}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Field
							name="email"
							validators={{
								onChange: ({ value }) => {
									if (!value) return "Email is required";
									if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email";
								},
							}}
						>
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className="text-sm font-medium">
										Email
									</label>
									<Input
										id={field.name}
										type="email"
										placeholder="john@example.com"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.map((error) => (
										<p key={String(error)} className="text-destructive text-sm">
											{error}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Subscribe selector={(state) => state.canSubmit}>
							{(canSubmit) => (
								<Button type="submit" disabled={!canSubmit || mutation.isPending}>
									{mutation.isPending ? "Creating..." : "Create Client"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Key Code</CardTitle>
				</CardHeader>
				<CardContent>
					<pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
						{`// core/functions/clients/binding.ts
const makeBindingRequest = async (path, options = {}) =>
  env.DATA_SERVICE.fetch(
    new Request(\`https://data-service\${path}\`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${env.DATA_SERVICE_API_TOKEN}\`,
        ...options.headers,
      },
      ...options,
    })
  );

export const createClientBinding = createServerFn({ method: 'POST' })
  .inputValidator((data) => ClientCreateRequestSchema.parse(data))
  .handler(async (ctx) => {
    const response = await makeBindingRequest('/clients', {
      method: 'POST',
      body: JSON.stringify(ctx.data),
    });
    if (!response.ok) return { success: false, error: '...' };
    const client = ClientSchema.parse(await response.json());
    return { success: true, client };
  });`}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}
