import { createFileRoute, Outlet, Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/demo/direct')({
  component: DirectLayout,
});

const operations = [
  { label: 'Overview', href: '/demo/direct' as const, exact: true },
  { label: 'Create', href: '/demo/direct/create' as const },
  { label: 'Read', href: '/demo/direct/read' as const },
  { label: 'List', href: '/demo/direct/list' as const },
  { label: 'Update', href: '/demo/direct/update' as const },
  { label: 'Delete', href: '/demo/direct/delete' as const },
];

function DirectLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge variant="success">SSR</Badge>
        <span className="text-sm font-mono text-muted-foreground">Server Fn → data-ops → DB</span>
      </div>

      <nav className="inline-flex items-center justify-center rounded-lg bg-muted p-[3px] h-9">
        {operations.map((op) => (
          <Link
            key={op.href}
            to={op.href}
            className="inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium text-foreground/60 transition-all hover:text-foreground [&.active]:bg-background [&.active]:text-foreground [&.active]:shadow-sm"
            activeOptions={{ exact: op.exact }}
          >
            {op.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
