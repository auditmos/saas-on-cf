import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PendingApproval } from "@/components/auth/pending-approval";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getAuthView } from "@/core/functions/auth/session";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
	// Runs on the server before anything under /_auth renders, so an
	// unauthenticated request is answered with a redirect instead of with the
	// protected content plus a client-side correction after the fact.
	beforeLoad: async () => {
		const auth = await getAuthView();

		if (auth.view === "signed-out") {
			throw redirect({ to: "/signin" });
		}

		return { auth };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const { auth } = Route.useRouteContext();
	const navigate = useNavigate();

	if (auth.view === "pending-approval") {
		return (
			<PendingApproval
				email={auth.email ?? ""}
				onSignOut={async () => {
					await authClient.signOut();
					navigate({ to: "/" });
				}}
			/>
		);
	}

	return (
		<div className="flex h-screen bg-background overflow-hidden">
			<Sidebar className="flex-shrink-0" />

			<div className="flex flex-1 flex-col overflow-hidden">
				<Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

				<main className="flex-1 overflow-y-auto bg-muted/20 p-6">
					<div className="mx-auto max-w-7xl">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
}
