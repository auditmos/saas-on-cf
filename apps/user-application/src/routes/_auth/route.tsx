import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
	component: RouteComponent,
});

function RouteComponent() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const session = authClient.useSession();
	const navigate = useNavigate();

	useEffect(() => {
		if (!session.isPending && !session.data) {
			navigate({ to: "/signin" });
		}
	}, [session.isPending, session.data, navigate]);

	if (session.isPending) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		);
	}

	if (!session.data) {
		return null;
	}

	const approved = (session.data.user as Record<string, unknown>).approved as boolean;

	if (!approved) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl font-bold">Account Pending</CardTitle>
						<CardDescription>
							Your account is awaiting admin approval. You'll gain access once approved.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="text-center text-sm text-muted-foreground">
							Signed in as {session.data.user.email}
						</div>
						<Button
							variant="outline"
							className="w-full"
							onClick={async () => {
								await authClient.signOut();
								navigate({ to: "/" });
							}}
						>
							Sign Out
						</Button>
					</CardContent>
				</Card>
			</div>
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
