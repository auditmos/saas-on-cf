import { Link } from "@tanstack/react-router";
import { ArrowRight, Shield, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function HeroSection() {
	return (
		<section className="relative px-6 lg:px-8 pt-24 sm:pt-32 pb-12 sm:pb-16">
			<div className="mx-auto max-w-4xl text-center">
				<div className="mb-8 flex flex-wrap justify-center gap-2">
					<Badge variant="secondary" className="mb-4">
						<Sparkles className="mr-1 h-3 w-3" />
						Production-Ready
					</Badge>
					<Badge variant="secondary" className="mb-4">
						<Zap className="mr-1 h-3 w-3" />
						Edge-Optimized
					</Badge>
					<Badge variant="secondary" className="mb-4">
						<Shield className="mr-1 h-3 w-3" />
						Type-Safe
					</Badge>
				</div>

				<h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
					Modern SaaS
					<span className="block text-primary">Starter Kit</span>
				</h1>

				<p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
					Ship your SaaS faster with pre-configured authentication, database, and payments. Built on
					TanStack Start with React 19, TypeScript, and edge-ready infrastructure. Everything you
					need to launch your next project.
				</p>

				<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
					<Button variant="default" size="lg" asChild>
						<Link to="/dashboard" className="inline-flex items-center">
							Go to Dashboard
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>

			{/* Background gradient */}
			<div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
				<div
					className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-secondary opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
					style={{
						clipPath:
							"polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
					}}
				/>
			</div>
		</section>
	);
}
