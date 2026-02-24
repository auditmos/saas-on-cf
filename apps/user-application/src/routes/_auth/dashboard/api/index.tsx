import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_auth/dashboard/api/")({
	component: ApiIndexPage,
});

const operations = [
	{ label: "Create", href: "/dashboard/api/create" as const, desc: "POST /clients from browser" },
	{ label: "Read", href: "/dashboard/api/read" as const, desc: "GET /clients/:id from browser" },
	{ label: "List", href: "/dashboard/api/list" as const, desc: "GET /clients from browser" },
	{
		label: "Update",
		href: "/dashboard/api/update" as const,
		desc: "PUT /clients/:id from browser",
	},
	{
		label: "Delete",
		href: "/dashboard/api/delete" as const,
		desc: "DELETE /clients/:id from browser",
	},
];

function ApiIndexPage() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>API Pattern</CardTitle>
					<CardDescription>Browser → fetch → data-service HTTP</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<pre className="bg-muted text-foreground p-4 rounded text-sm overflow-x-auto">
						{`Browser (React)
  │
  │ 1. useQuery/useMutation calls fetchClients(), etc.
  │    fetch(VITE_DATA_SERVICE_URL + '/clients')
  ▼
Public Internet
  │
  │ 2. HTTP request (crosses network, requires CORS)
  ▼
data-service (Hono API)
  │
  │ 3. CORS check → authMiddleware → zValidator → clientService
  ▼
data-ops queries → Neon Postgres`}
					</pre>

					<div className="grid md:grid-cols-2 gap-4">
						<div>
							<h4 className="font-semibold text-success-foreground">Pros</h4>
							<ul className="text-sm list-disc list-inside mt-2 space-y-1 text-muted-foreground">
								<li>Standard HTTP - works from any client</li>
								<li>Shared API with mobile apps</li>
								<li>CORS-enabled for third parties</li>
								<li>CDN cacheable responses</li>
								<li>No server function overhead</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-destructive">Cons</h4>
							<ul className="text-sm list-disc list-inside mt-2 space-y-1 text-muted-foreground">
								<li>No SSR support</li>
								<li>Client manages auth tokens</li>
								<li>Network latency (public internet)</li>
								<li>API structure exposed to public</li>
								<li>Loading states visible to users</li>
							</ul>
						</div>
					</div>

					<div className="bg-info/10 p-4 rounded">
						<h4 className="font-semibold text-foreground">When to Use</h4>
						<p className="text-sm mt-1 text-muted-foreground">
							Mobile apps, third-party integrations, public API consumers
						</p>
					</div>

					<div className="bg-warning/10 p-4 rounded">
						<h4 className="font-semibold text-foreground">When NOT to Use</h4>
						<p className="text-sm mt-1 text-muted-foreground">
							Need SSR, sensitive operations, internal-only features
						</p>
					</div>

					<div className="bg-destructive/10 p-4 rounded">
						<h4 className="font-semibold text-foreground">Security Note</h4>
						<p className="text-sm mt-1 text-muted-foreground">
							API tokens used in browser are visible to users. Use this pattern for public data or
							implement proper user authentication (OAuth, sessions) for sensitive operations.
						</p>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-5">
				{operations.map((op) => (
					<Link key={op.href} to={op.href}>
						<Card className="h-full hover:border-primary transition-colors">
							<CardHeader className="p-4">
								<CardTitle className="text-base">{op.label}</CardTitle>
								<CardDescription className="text-xs">{op.desc}</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
