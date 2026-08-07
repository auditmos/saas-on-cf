import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PendingApprovalProps {
	email: string;
	onSignOut: () => void;
}

/**
 * Shown to a signed-in user whose account has not been approved yet. This is
 * deliberately not the signed-out experience: the user is authenticated, and
 * telling them otherwise sends them back to the sign-in form for a problem
 * signing in again will not solve.
 */
export function PendingApproval({ email, onSignOut }: PendingApprovalProps) {
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
					<div className="text-center text-sm text-muted-foreground">Signed in as {email}</div>
					<Button variant="outline" className="w-full" onClick={onSignOut}>
						Sign Out
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
