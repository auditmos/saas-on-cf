import { createFileRoute, Outlet, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/demo')({
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Data Flow Demos</h1>
          <nav className="mt-4 flex gap-4 flex-wrap">
            <Link
              to="/demo/users-list-api"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              GET Users (Client→API)
            </Link>
            <Link
              to="/demo/user-detail-direct"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              GET User (Server→data-ops)
            </Link>
            <Link
              to="/demo/user-create-binding"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              POST User (Server→Binding)
            </Link>
            <Link
              to="/demo/user-update-direct"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              PUT User (Server→data-ops)
            </Link>
            <Link
              to="/demo/user-delete-direct"
              className="text-sm hover:underline [&.active]:font-bold"
            >
              DELETE User (Server→data-ops)
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
