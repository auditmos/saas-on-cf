import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

interface EmailAuthProps {
	mode: "signin" | "signup";
}

interface AuthError {
	message: string;
}

export function EmailAuth({ mode }: EmailAuthProps) {
	const navigate = useNavigate();
	const [signupSuccess, setSignupSuccess] = useState(false);

	const mutation = useMutation({
		mutationFn: async (data: { name?: string; email: string; password: string }) => {
			if (mode === "signup") {
				const result = await authClient.signUp.email({
					name: data.name ?? "",
					email: data.email,
					password: data.password,
				});
				if (result.error) throw new Error(result.error.message);
				return { mode: "signup" as const };
			}
			const result = await authClient.signIn.email({
				email: data.email,
				password: data.password,
			});
			if (result.error) throw new Error(result.error.message);
			return { mode: "signin" as const };
		},
	});

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		onSubmit: async ({ value }) => {
			mutation.reset();
			const result = await mutation.mutateAsync(value);
			if (result.mode === "signup") {
				setSignupSuccess(true);
			} else {
				navigate({ to: "/dashboard" });
			}
		},
	});

	if (signupSuccess) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl font-bold text-foreground">Account Created</CardTitle>
						<CardDescription>
							Your account is pending admin approval. You'll be able to sign in once approved.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link to="/signin">
							<Button variant="outline" className="w-full">
								Back to Sign In
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold text-foreground">
						{mode === "signin" ? "Welcome back" : "Create account"}
					</CardTitle>
					<CardDescription>
						{mode === "signin" ? "Sign in to your account" : "Sign up for a new account"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{mutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>
								{(mutation.error as AuthError).message ?? "Something went wrong"}
							</AlertDescription>
						</Alert>
					)}

					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
						{mode === "signup" && (
							<form.Field
								name="name"
								validators={{
									onChange: ({ value }) => (!value ? "Name is required" : undefined),
								}}
							>
								{(field) => (
									<div className="space-y-1">
										<label htmlFor={field.name} className="text-sm font-medium text-foreground">
											Name
										</label>
										<Input
											id={field.name}
											placeholder="Your name"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
										/>
										{field.state.meta.errors.map((error) => (
											<p key={String(error)} className="text-destructive text-sm">
												{error}
											</p>
										))}
									</div>
								)}
							</form.Field>
						)}

						<form.Field
							name="email"
							validators={{
								onChange: ({ value }) => {
									if (!value) return "Email is required";
									if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email";
								},
							}}
						>
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className="text-sm font-medium text-foreground">
										Email
									</label>
									<Input
										id={field.name}
										type="email"
										placeholder="you@example.com"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.map((error) => (
										<p key={String(error)} className="text-destructive text-sm">
											{error}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Field
							name="password"
							validators={{
								onChange: ({ value }) => {
									if (!value) return "Password is required";
									if (value.length < 8) return "Min 8 characters";
								},
							}}
						>
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className="text-sm font-medium text-foreground">
										Password
									</label>
									<Input
										id={field.name}
										type="password"
										placeholder="Min 8 characters"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
									{field.state.meta.errors.map((error) => (
										<p key={String(error)} className="text-destructive text-sm">
											{error}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Subscribe selector={(state) => state.canSubmit}>
							{(canSubmit) => (
								<Button
									type="submit"
									className="w-full h-12"
									disabled={!canSubmit || mutation.isPending}
								>
									{mutation.isPending ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
								</Button>
							)}
						</form.Subscribe>
					</form>

					<div className="text-center text-sm text-muted-foreground">
						{mode === "signin" ? (
							<>
								Don&apos;t have an account?{" "}
								<Link to="/signup" className="text-primary hover:underline">
									Sign up
								</Link>
							</>
						) : (
							<>
								Already have an account?{" "}
								<Link to="/signin" className="text-primary hover:underline">
									Sign in
								</Link>
							</>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
