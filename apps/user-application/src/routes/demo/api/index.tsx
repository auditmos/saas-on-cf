import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/demo/api/')({
  component: ApiIndexPage,
});

const operations = [
  { label: 'Create', href: '/demo/api/create' as const, desc: 'POST /users from browser' },
  { label: 'Read', href: '/demo/api/read' as const, desc: 'GET /users/:id from browser' },
  { label: 'List', href: '/demo/api/list' as const, desc: 'GET /users from browser' },
  { label: 'Update', href: '/demo/api/update' as const, desc: 'PUT /users/:id from browser' },
  { label: 'Delete', href: '/demo/api/delete' as const, desc: 'DELETE /users/:id from browser' },
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
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`Browser (React)
  │
  │ 1. useQuery/useMutation calls fetchUsers(), etc.
  │    fetch(VITE_DATA_SERVICE_URL + '/users')
  ▼
Public Internet
  │
  │ 2. HTTP request (crosses network, requires CORS)
  ▼
data-service (Hono API)
  │
  │ 3. CORS check → authMiddleware → zValidator → userService
  ▼
data-ops queries → Neon Postgres`}
          </pre>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-success-foreground">Pros</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>Standard HTTP - works from any client</li>
                <li>Shared API with mobile apps</li>
                <li>CORS-enabled for third parties</li>
                <li>CDN cacheable responses</li>
                <li>No server function overhead</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-destructive">Cons</h4>
              <ul className="text-sm list-disc list-inside mt-2 space-y-1">
                <li>No SSR support</li>
                <li>Client manages auth tokens</li>
                <li>Network latency (public internet)</li>
                <li>API structure exposed to public</li>
                <li>Loading states visible to users</li>
              </ul>
            </div>
          </div>

          <div className="bg-info/10 p-4 rounded">
            <h4 className="font-semibold">When to Use</h4>
            <p className="text-sm mt-1">Mobile apps, third-party integrations, public API consumers</p>
          </div>

          <div className="bg-warning/10 p-4 rounded">
            <h4 className="font-semibold">When NOT to Use</h4>
            <p className="text-sm mt-1">Need SSR, sensitive operations, internal-only features</p>
          </div>

          <div className="bg-destructive/10 p-4 rounded">
            <h4 className="font-semibold">Security Note</h4>
            <p className="text-sm mt-1">
              API tokens used in browser are visible to users. Use this pattern for public data
              or implement proper user authentication (OAuth, sessions) for sensitive operations.
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
