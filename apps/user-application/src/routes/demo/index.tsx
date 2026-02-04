import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/demo/')({
  component: DemoIndexPage,
});

const patterns = [
  {
    title: 'Direct',
    href: '/demo/direct' as const,
    description: 'Server Function → data-ops → DB',
    ssr: true,
    pros: ['Lowest latency', 'Full transaction control', 'SSR support'],
    cons: ['Logic not shared with API', 'No rate limiting'],
    useWhen: 'Performance-critical, full control needed',
  },
  {
    title: 'Binding',
    href: '/demo/binding' as const,
    description: 'Server Function → DATA_SERVICE.fetch → data-service → DB',
    ssr: true,
    pros: ['Shared logic with API', 'Internal network', 'SSR support'],
    cons: ['Extra hop latency', 'Depends on data-service'],
    useWhen: 'Shared business logic, centralized validation',
  },
  {
    title: 'API',
    href: '/demo/api' as const,
    description: 'Browser → fetch → data-service HTTP',
    ssr: false,
    pros: ['Standard HTTP', 'Works from any client', 'CORS-enabled'],
    cons: ['No SSR', 'Client manages auth', 'Network latency'],
    useWhen: 'Mobile apps, third-party integrations',
  },
];

function DemoIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose a Pattern</h2>
        <p className="text-muted-foreground mt-1">
          Each pattern demonstrates complete CRUD operations with different data flows
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {patterns.map((pattern) => (
          <Link key={pattern.href} to={pattern.href}>
            <Card className="h-full hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{pattern.title}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded ${pattern.ssr ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                    {pattern.ssr ? 'SSR' : 'Client Only'}
                  </span>
                </div>
                <CardDescription className="font-mono text-xs">
                  {pattern.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-green-700 font-medium">Pros: </span>
                  {pattern.pros.join(', ')}
                </div>
                <div>
                  <span className="text-red-700 font-medium">Cons: </span>
                  {pattern.cons.join(', ')}
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium">Use when: </span>
                  {pattern.useWhen}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
