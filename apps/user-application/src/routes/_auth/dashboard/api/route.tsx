import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_auth/dashboard/api")({
	component: ApiLayout,
});

const operations = [
	{ label: "Overview", href: "/dashboard/api" as const, exact: true },
	{ label: "Create", href: "/dashboard/api/create" as const },
	{ label: "Read", href: "/dashboard/api/read" as const },
	{ label: "List", href: "/dashboard/api/list" as const },
	{ label: "Update", href: "/dashboard/api/update" as const },
	{ label: "Delete", href: "/dashboard/api/delete" as const },
];

function ApiLayout() {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Badge variant="warning">Client Only</Badge>
				<span className="text-sm font-mono text-muted-foreground">
					Browser → fetch → data-service HTTP
				</span>
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
