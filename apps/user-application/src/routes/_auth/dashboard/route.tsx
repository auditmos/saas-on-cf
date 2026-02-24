import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/dashboard")({
	component: DemoLayout,
});

function DemoLayout() {
	return (
		<div className="min-h-screen bg-background">
			<header className="border-b sticky top-0 z-10 bg-background">
				<div className="container mx-auto px-4 py-4">
					<Link
						to="/dashboard"
						className="text-3xl font-bold tracking-tight text-foreground hover:text-primary transition-colors sm:text-4xl"
					>
						Data Flow Demos
					</Link>
				</div>
			</header>
			<main className="container mx-auto px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
