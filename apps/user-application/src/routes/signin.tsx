import { createFileRoute, redirect } from "@tanstack/react-router";
import { EmailAuth } from "@/components/auth/email-auth";

export const Route = createFileRoute("/signin")({
  component: SigninPage,
});

function SigninPage() {
  return <EmailAuth mode="signin" />;
}
