import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_auth/dashboard/direct/")({
	component: DirectIndexPage,
});

const operations = [
	{
		label: "Create",
		href: "/dashboard/direct/create" as const,
		desc: "Insert new client via createClient()",
	},
	{
		label: "Read",
		href: "/dashboard/direct/read" as const,
		desc: "Fetch single client via getClient()",
	},
	{
		label: "List",
		href: "/dashboard/direct/list" as const,
		desc: "Paginated clients via getClients()",
	},
	{
		label: "Update",
		href: "/dashboard/direct/update" as const,
		desc: "Modify client via updateClient()",
	},
	{
		label: "Delete",
		href: "/dashboard/direct/delete" as const,
		desc: "Remove client via deleteClient()",
	},
];

function DirectIndexPage() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Direct Pattern</CardTitle>
					<CardDescription>Server Function → data-ops → DB</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<pre className="bg-muted text-foreground p-4 rounded text-sm overflow-x-auto">
						{`Browser
  │
  │ 1. Route loader / mutation
  ▼
Server Function
  │
  │ 2. Import from @repo/data-ops
  ▼
data-ops queries (getClient, createClient, etc.)
  │
  │ 3. Direct Drizzle ORM call
  ▼
Neon Postgres`}
					</pre>

					<div className="grid md:grid-cols-2 gap-4">
						<div>
							<h4 className="font-semibold text-success-foreground">Pros</h4>
							<ul className="text-sm list-disc list-inside mt-2 space-y-1 text-muted-foreground">
								<li>Lowest latency (no extra hop)</li>
								<li>Full transaction control</li>
								<li>SSR support via loader</li>
								<li>Optimistic updates</li>
								<li>Direct ORM access</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold text-destructive">Cons</h4>
							<ul className="text-sm list-disc list-inside mt-2 space-y-1 text-muted-foreground">
								<li>Logic not shared with data-service API</li>
								<li>No automatic rate limiting</li>
								<li>Audit logging manual</li>
								<li>Testing requires DB setup</li>
							</ul>
						</div>
					</div>

					<div className="bg-info/10 p-4 rounded">
						<h4 className="font-semibold text-foreground">When to Use</h4>
						<p className="text-sm mt-1 text-muted-foreground">
							Performance-critical reads, complex transactions, SSR required
						</p>
					</div>

					<div className="bg-warning/10 p-4 rounded">
						<h4 className="font-semibold text-foreground">When NOT to Use</h4>
						<p className="text-sm mt-1 text-muted-foreground">
							Need shared validation with external API, rate limiting required
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
