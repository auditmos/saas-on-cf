import { createFileRoute, Outlet, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/demo/api')({
  component: ApiLayout,
});

const operations = [
  { label: 'Overview', href: '/demo/api' as const, exact: true },
  { label: 'Create', href: '/demo/api/create' as const },
  { label: 'Read', href: '/demo/api/read' as const },
  { label: 'List', href: '/demo/api/list' as const },
  { label: 'Update', href: '/demo/api/update' as const },
  { label: 'Delete', href: '/demo/api/delete' as const },
];

function ApiLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">Client Only</span>
        <span>Browser → fetch → data-service HTTP</span>
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
