import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_auth/dashboard/binding")({
	component: BindingLayout,
});

const operations = [
	{ label: "Overview", href: "/dashboard/binding" as const, exact: true },
	{ label: "Create", href: "/dashboard/binding/create" as const },
	{ label: "Read", href: "/dashboard/binding/read" as const },
	{ label: "List", href: "/dashboard/binding/list" as const },
	{ label: "Update", href: "/dashboard/binding/update" as const },
	{ label: "Delete", href: "/dashboard/binding/delete" as const },
];

function BindingLayout() {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Badge variant="success">SSR</Badge>
				<span className="text-sm font-mono text-muted-foreground">
					Server Fn → DATA_SERVICE.fetch → data-service → DB
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
