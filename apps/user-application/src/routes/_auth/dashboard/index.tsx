import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_auth/dashboard/")({
	component: DemoIndexPage,
});

const directOps = [
	{
		label: "Create",
		href: "/dashboard/direct/create" as const,
		desc: "Insert new client via createClient()",
	},
	{
		label: "Read",
		href: "/dashboard/direct" as const,
		desc: "Fetch single client via getClient()",
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

const bindingOps = [
	{
		label: "Create",
		href: "/dashboard/binding/create" as const,
		desc: "POST /clients via service binding",
	},
	{
		label: "Read",
		href: "/dashboard/binding" as const,
		desc: "GET /clients/:id via service binding",
	},
	{
		label: "Update",
		href: "/dashboard/binding/update" as const,
		desc: "PUT /clients/:id via service binding",
	},
	{
		label: "Delete",
		href: "/dashboard/binding/delete" as const,
		desc: "DELETE /clients/:id via service binding",
	},
];

const apiOps = [
	{ label: "Create", href: "/dashboard/api/create" as const, desc: "POST /clients from browser" },
	{ label: "Read", href: "/dashboard/api" as const, desc: "GET /clients/:id from browser" },
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

function DemoIndexPage() {
	return (
		<div className="space-y-6">
			<div className="mx-auto max-w-2xl text-center">
				<h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
					Data Access Patterns
				</h2>
				<p className="mt-4 text-lg text-muted-foreground">
					Three approaches to data fetching with different trade-offs. Each shows complete CRUD
					operations.
				</p>
			</div>

			<Tabs defaultValue="direct" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="direct">Direct</TabsTrigger>
					<TabsTrigger value="binding">Binding</TabsTrigger>
					<TabsTrigger value="api">API</TabsTrigger>
				</TabsList>

				<TabsContent value="direct" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Direct Pattern</CardTitle>
								<Badge>SSR</Badge>
							</div>
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
									<h4 className="font-semibold text-foreground mb-2">Pros</h4>
									<ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
										<li>Lowest latency (no extra hop)</li>
										<li>Full transaction control</li>
										<li>SSR support via loader</li>
										<li>Direct ORM access</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold text-foreground mb-2">Cons</h4>
									<ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
										<li>Logic not shared with data-service API</li>
										<li>No automatic rate limiting</li>
										<li>Testing requires DB setup</li>
									</ul>
								</div>
							</div>

							<div className="space-y-2">
								<div className="bg-muted p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Use when:</span> Performance-critical reads,
										complex transactions, SSR required
									</p>
								</div>
								<div className="bg-muted p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Avoid when:</span> Need shared validation with
										external API, rate limiting required
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<div>
						<h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-4">
							CRUD Operations
						</h3>
						<div className="grid gap-3 md:grid-cols-4">
							{directOps.map((op) => (
								<Link key={op.href} to={op.href}>
									<Card className="hover:border-primary transition-colors">
										<CardHeader className="p-4">
											<CardTitle className="text-base">{op.label}</CardTitle>
											<CardDescription className="text-xs">{op.desc}</CardDescription>
										</CardHeader>
									</Card>
								</Link>
							))}
						</div>
					</div>
				</TabsContent>

				<TabsContent value="binding" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Binding Pattern</CardTitle>
								<Badge>SSR</Badge>
							</div>
							<CardDescription>
								Server Function → DATA_SERVICE.fetch → data-service → DB
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<pre className="bg-muted text-foreground p-4 rounded text-sm overflow-x-auto">
								{`Browser
  │
  │ 1. Route loader / mutation
  ▼
Server Function
  │
  │ 2. env.DATA_SERVICE.fetch('https://data-service/clients')
  │    + Authorization: Bearer <token>
  ▼
Cloudflare Service Binding (internal network)
  │
  │ 3. data-service Hono API
  │    → authMiddleware → zValidator → clientService
  ▼
data-ops queries → Neon Postgres`}
							</pre>

							<div className="grid md:grid-cols-2 gap-4">
								<div>
									<h4 className="font-semibold text-foreground mb-2">Pros</h4>
									<ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
										<li>Shared logic with data-service API</li>
										<li>Internal network (no CORS)</li>
										<li>SSR support via loader</li>
										<li>Rate limiting via API layer</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold text-foreground mb-2">Cons</h4>
									<ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
										<li>Extra hop latency</li>
										<li>Depends on data-service availability</li>
										<li>More complex debugging</li>
									</ul>
								</div>
							</div>

							<div className="space-y-2">
								<div className="bg-muted p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Use when:</span> Internal microservices, shared
										business logic, centralized validation
									</p>
								</div>
								<div className="bg-muted p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Avoid when:</span> Need lowest latency,
										data-service down = app down
									</p>
								</div>
								<div className="bg-accent/20 p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Service Binding:</span> Hostname in URL is
										ignored - requests go directly to bound worker via internal network. No CORS, no
										public latency.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<div>
						<h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-4">
							CRUD Operations
						</h3>
						<div className="grid gap-3 md:grid-cols-4">
							{bindingOps.map((op) => (
								<Link key={op.href} to={op.href}>
									<Card className="hover:border-primary transition-colors">
										<CardHeader className="p-4">
											<CardTitle className="text-base">{op.label}</CardTitle>
											<CardDescription className="text-xs">{op.desc}</CardDescription>
										</CardHeader>
									</Card>
								</Link>
							))}
						</div>
					</div>
				</TabsContent>

				<TabsContent value="api" className="space-y-6 mt-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>API Pattern</CardTitle>
								<Badge variant="secondary">Client Only</Badge>
							</div>
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
									<h4 className="font-semibold text-foreground mb-2">Pros</h4>
									<ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
										<li>Standard HTTP - works from any client</li>
										<li>Shared API with mobile apps</li>
										<li>CORS-enabled for third parties</li>
										<li>CDN cacheable responses</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold text-foreground mb-2">Cons</h4>
									<ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
										<li>No SSR support</li>
										<li>Client manages auth tokens</li>
										<li>Network latency (public internet)</li>
										<li>Loading states visible to users</li>
									</ul>
								</div>
							</div>

							<div className="space-y-2">
								<div className="bg-muted p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Use when:</span> Mobile apps, third-party
										integrations, public API consumers
									</p>
								</div>
								<div className="bg-muted p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Avoid when:</span> Need SSR, sensitive
										operations, internal-only features
									</p>
								</div>
								<div className="bg-destructive/10 p-3 rounded">
									<p className="text-sm text-foreground">
										<span className="font-semibold">Security:</span> API tokens used in browser are
										visible to users. Use for public data or implement proper authentication for
										sensitive ops.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<div>
						<h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-4">
							CRUD Operations
						</h3>
						<div className="grid gap-3 md:grid-cols-4">
							{apiOps.map((op) => (
								<Link key={op.href} to={op.href}>
									<Card className="hover:border-primary transition-colors">
										<CardHeader className="p-4">
											<CardTitle className="text-base">{op.label}</CardTitle>
											<CardDescription className="text-xs">{op.desc}</CardDescription>
										</CardHeader>
									</Card>
								</Link>
							))}
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
