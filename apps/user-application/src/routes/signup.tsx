import { createFileRoute } from "@tanstack/react-router";
import { EmailAuth } from "@/components/auth/email-auth";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

function SignupPage() {
	return <EmailAuth mode="signup" />;
}
