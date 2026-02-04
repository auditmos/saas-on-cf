import { createFileRoute, Outlet, Link } from '@tanstack/react-router';

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">SSR</span>
        <span>Server Fn → data-ops → DB</span>
      </div>

      <nav className="flex gap-4 border-b pb-2">
        {operations.map((op) => (
          <Link
            key={op.href}
            to={op.href}
            className="text-sm hover:underline [&.active]:font-bold"
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
