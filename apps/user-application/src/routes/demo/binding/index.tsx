import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/demo/binding/')({
  component: BindingIndexPage,
});

const operations = [
  { label: 'Create', href: '/demo/binding/create' as const, desc: 'POST /users via service binding' },
  { label: 'Read', href: '/demo/binding/read' as const, desc: 'GET /users/:id via service binding' },
  { label: 'List', href: '/demo/binding/list' as const, desc: 'GET /users via service binding' },
  { label: 'Update', href: '/demo/binding/update' as const, desc: 'PUT /users/:id via service binding' },
  { label: 'Delete', href: '/demo/binding/delete' as const, desc: 'DELETE /users/:id via service binding' },
];

function BindingIndexPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Binding Pattern</CardTitle>
          <CardDescription>Server Function → DATA_SERVICE.fetch → data-service → DB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser
  │
  │ 1. Route loader / mutation
  ▼
Server Function
  │
  │ 2. env.DATA_SERVICE.fetch('https://data-service/users')
  │    + Authorization: Bearer <token>
  ▼
Cloudflare Service Binding (internal network)
  │
  │ 3. data-service Hono API
  │    → authMiddleware → zValidator → userService
  ▼
data-ops queries → Neon Postgres`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-success-foreground">Pros</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Shared logic with data-service API</li>
                <li>Internal network (no CORS)</li>
                <li>SSR support via loader</li>
                <li>Rate limiting via API layer</li>
                <li>Centralized validation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-destructive">Cons</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Extra hop latency</li>
                <li>Depends on data-service availability</li>
                <li>API token management</li>
                <li>More complex debugging</li>
              </ul>
            </div>
          </div>

          <div className="bg-info/10 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">Internal microservices, shared business logic, centralized validation</p>
          </div>

          <div className="bg-warning/10 p-4 rounded">
            <h4 className="font-semibold">When NOT to Use</h4>
            <p className="text-sm mt-1">Need lowest latency, data-service down = app down</p>
          </div>

          <div className="bg-accent/50 p-4 rounded">
            <h4 className="font-semibold">Service Binding Advantage</h4>
            <p className="text-sm mt-1">
              Hostname in URL is ignored - requests go directly to bound worker via Cloudflare's
              internal network. No CORS, no public network latency, no egress costs.
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
