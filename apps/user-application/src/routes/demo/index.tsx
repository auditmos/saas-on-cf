import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const Route = createFileRoute('/demo/')({
  component: DemoIndexPage,
});

function DemoIndexPage() {
  const demos = [
    {
      title: 'GET Users - Client → API',
      description: 'Browser fetches directly from data-service public endpoint',
      href: '/demo/users-list-api' as const,
      pattern: 'Pattern A',
      ssr: false,
    },
    {
      title: 'GET User - Server → data-ops',
      description: 'Server function queries data-ops directly, bypassing API layer',
      href: '/demo/user-detail-direct' as const,
      pattern: 'Pattern C',
      ssr: true,
    },
    {
      title: 'POST User - Server → Binding',
      description: 'Server function calls data-service via Cloudflare service binding',
      href: '/demo/user-create-binding' as const,
      pattern: 'Pattern B',
      ssr: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose a Demo</h2>
        <p className="text-muted-foreground mt-1">
          Each demo showcases a different data flow pattern
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {demos.map((demo) => (
          <Link key={demo.href} to={demo.href}>
            <Card className="h-full hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-muted px-2 py-1 rounded">
                    {demo.pattern}
                  </span>
                  <span className={`text-xs ${demo.ssr ? 'text-green-600' : 'text-orange-600'}`}>
                    {demo.ssr ? 'SSR ✓' : 'Client Only'}
                  </span>
                </div>
                <CardTitle className="text-lg mt-2">{demo.title}</CardTitle>
                <CardDescription>{demo.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
