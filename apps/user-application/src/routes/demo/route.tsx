import { createFileRoute, Outlet, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/demo')({
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/demo" className="text-2xl font-bold hover:underline">
            Data Flow Demos
          </Link>
          <nav className="mt-4 flex gap-6">
            <Link
              to="/demo/direct"
              className="text-sm hover:underline [&.active]:font-bold"
              activeOptions={{ exact: false }}
            >
              Direct (data-ops)
            </Link>
            <Link
              to="/demo/binding"
              className="text-sm hover:underline [&.active]:font-bold"
              activeOptions={{ exact: false }}
            >
              Binding (service)
            </Link>
            <Link
              to="/demo/api"
              className="text-sm hover:underline [&.active]:font-bold"
              activeOptions={{ exact: false }}
            >
              API (browser)
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
