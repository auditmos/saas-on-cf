import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRightIcon,
  BookOpenIcon,
  DatabaseIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  Bot,
  Sparkles,
  CheckCircle,
} from "lucide-react";

export const Route = createFileRoute("/_static/docs/")({
  component: RouteComponent,
});

const gettingStartedSteps = [
  {
    name: "database",
    title: "Database Setup",
    description:
      "Configure your serverless database with edge optimization and HTTP proxying to prevent connection overwhelm in isolated environments.",
    icon: DatabaseIcon,
    image: "/cloudflare.png",
    badgeVariant: "default" as const,
    features: [
      "Edge Optimized",
      "Connection Pooling",
      "HTTP Proxy",
      "Serverless Ready",
    ],
  },
  {
    name: "authentication",
    title: "Authentication Setup",
    description:
      "Set up comprehensive authentication with Better Auth, including social providers, email/password, and session management for serverless environments.",
    icon: ShieldCheckIcon,
    image: "/better-auth.png",
    badgeVariant: "secondary" as const,
    features: [
      "Social OAuth",
      "Session Management",
      "Database Agnostic",
      "Edge Compatible",
    ],
  },
  {
    name: "polar",
    title: "Payment Integration",
    description:
      "Integrate Polar for modern subscription management and payment processing without webhooks or external database tables.",
    icon: CreditCardIcon,
    image: "/polar.png",
    badgeVariant: "outline" as const,
    features: [
      "Subscription Management",
      "No Webhooks",
      "Developer Focused",
      "API Integration",
    ],
  },
];

function RouteComponent() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <BookOpenIcon className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Documentation
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          Comprehensive guides for your mono repo SaaS kit built with TanStack
          Start, covering authentication, database setup, and payment
          integration.
        </p>
        <Badge variant="secondary" className="text-sm">
          Mono Repo Architecture
        </Badge>
      </div>

      {/* Tech Stack Banner */}
      <div className="mb-12">
        <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Built with Modern Technologies
                </h3>
                <p className="text-muted-foreground">
                  TanStack Start, React 19, TypeScript, Tailwind CSS v4, and
                  Shadcn/UI
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <img
                  src="/tanstack.png"
                  alt="TanStack"
                  className="h-8 w-8 rounded"
                />
                <img
                  src="/shadcn.png"
                  alt="Shadcn/UI"
                  className="h-8 w-8 rounded"
                />
                <img
                  src="/logo192.png"
                  alt="React"
                  className="h-8 w-8 rounded"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claude Code Setup Section */}
      <div className="mb-12">
        <Card className="bg-gradient-to-b from-background to-muted/20 border">
          <CardContent className="p-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-Powered Setup
              </Badge>
              <h3 className="text-2xl font-semibold mb-4">
                Quick Setup with Claude Code
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Skip the manual setup and let Claude Code agents configure your
                entire project automatically.
              </p>
              <div className="mb-6">
                <img
                  src="/claude-code-cli.webp"
                  alt="Claude Code CLI"
                  className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
                />
              </div>
              <div className="bg-muted/30 rounded-lg p-6 border max-w-lg mx-auto">
                <p className="text-muted-foreground mb-4">
                  Just say this to Claude Code:
                </p>
                <div className="bg-background rounded-lg p-4 font-mono text-sm border">
                  <span className="text-primary">
                    Help me setup this project
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Section */}
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Getting Started Guide
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Follow these steps in order to set up your SaaS application. Each
            step builds on the previous one.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {gettingStartedSteps.map((step) => {
            const IconComponent = step.icon;

            return (
              <Card
                key={step.name}
                className="group hover:shadow-lg transition-all duration-200 h-full"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </div>
                  <div className="flex justify-center mb-4">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="h-16 w-16 object-contain rounded-lg bg-background border p-2"
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-4 leading-relaxed">
                    {step.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {step.features.map((feature) => (
                      <Badge
                        key={feature}
                        variant="secondary"
                        className="text-xs"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Link
                    to="/docs/$name"
                    params={{ name: step.name }}
                    className="block"
                  >
                    <Button className="w-full group-hover:bg-primary/90 transition-colors">
                      Start {step.title}
                      <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Access Section */}
      <Card className="border-dashed bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5" />
            Quick Access
          </CardTitle>
          <CardDescription>
            Jump directly to any documentation section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gettingStartedSteps.map((step) => {
              const IconComponent = step.icon;
              return (
                <Link
                  key={step.name}
                  to="/docs/$name"
                  params={{ name: step.name }}
                >
                  <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group border-muted">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-semibold group-hover:text-primary transition-colors">
                          {step.title}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Course Promo Section */}
      <div className="mt-16 mb-8 bg-gradient-to-b from-background to-muted/20 -mx-4 px-4 py-8">
        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/1-dXh8J08UI?si=aSyQCYk1YVJAlG7X"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <div className="mt-8 text-center">
          <Badge className="mb-4" variant="secondary">
            9 Modules • 11 Hours • 58 Video Lessons
          </Badge>

          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Master Full-Stack Development on Cloudflare Workers
          </h2>

          <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
            Take your skills to the next level with our comprehensive course.
            Build production-ready SaaS applications with sub-50ms response
            times globally.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8 text-left max-w-3xl mx-auto">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-2">What You'll Build</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    SmartLinks - Complete short link service
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Location-based intelligent redirects
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">AI-powered link analysis</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Real-time analytics dashboard</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-2">
                Technologies Covered
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Cloudflare D1, KV, R2, Workers AI
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Durable Objects for state management
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Better Auth & Stripe integration
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">TypeScript, Drizzle ORM, pnpm</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild>
              <a
                href="https://learn.backpine.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Enroll in Course
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
