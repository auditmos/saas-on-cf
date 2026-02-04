import { createFileRoute, Outlet, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/demo/binding')({
  component: BindingLayout,
});

const operations = [
  { label: 'Overview', href: '/demo/binding' as const, exact: true },
  { label: 'Create', href: '/demo/binding/create' as const },
  { label: 'Read', href: '/demo/binding/read' as const },
  { label: 'List', href: '/demo/binding/list' as const },
  { label: 'Update', href: '/demo/binding/update' as const },
  { label: 'Delete', href: '/demo/binding/delete' as const },
];

function BindingLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">SSR</span>
        <span>Server Fn → DATA_SERVICE.fetch → data-service → DB</span>
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
