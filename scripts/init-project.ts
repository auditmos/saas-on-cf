import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Helpers ──────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

function abs(...segments: string[]): string {
	return path.join(ROOT, ...segments);
}

function replaceInFile(filePath: string, search: string | RegExp, replacement: string) {
	const content = fs.readFileSync(filePath, "utf-8");
	fs.writeFileSync(filePath, content.replace(search, replacement), "utf-8");
}

function replaceAllInFile(filePath: string, search: string, replacement: string) {
	const content = fs.readFileSync(filePath, "utf-8");
	fs.writeFileSync(filePath, content.replaceAll(search, replacement), "utf-8");
}

function rmDir(dirPath: string) {
	if (fs.existsSync(dirPath)) {
		fs.rmSync(dirPath, { recursive: true, force: true });
	}
}

function rmFile(filePath: string) {
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
	const name = await prompt("Project name (kebab-case): ");

	if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
		console.error("Invalid name. Must be kebab-case (e.g. my-app).");
		process.exit(1);
	}

	console.log(`\nInitializing project: ${name}\n`);

	// ── Step 1: Rename project references ────────────────────────────

	console.log("[1/12] Renaming project references...");

	// wrangler files: replace all occurrences of saas-on-cf
	replaceAllInFile(abs("apps/data-service/wrangler.jsonc"), "saas-on-cf", name);
	replaceAllInFile(abs("apps/user-application/wrangler.jsonc"), "saas-on-cf", name);

	// root package.json only — sub-package names stay as-is (pnpm filter depends on them)
	replaceInFile(abs("package.json"), `"name": "saas-on-cf"`, `"name": "${name}"`);

	// Post-login redirect: /dashboard → /home
	replaceInFile(
		abs("apps/user-application/src/components/auth/email-auth.tsx"),
		'navigate({ to: "/dashboard" })',
		'navigate({ to: "/home" })',
	);

	// Navigation brand text
	replaceInFile(
		abs("apps/user-application/src/components/navigation/navigation-bar.tsx"),
		"SaaS Starter Kit",
		name,
	);

	// Root SEO title/description
	replaceInFile(
		abs("apps/user-application/src/routes/__root.tsx"),
		`title: "TanStack Start | Type-Safe, Client-First, Full-Stack React Framework"`,
		`title: "${name}"`,
	);
	replaceInFile(
		abs("apps/user-application/src/routes/__root.tsx"),
		"description: `TanStack Start is a type-safe, client-first, full-stack React framework. `",
		`description: "${name}"`,
	);

	// Landing hero
	replaceInFile(
		abs("apps/user-application/src/components/landing/hero-section.tsx"),
		`Modern SaaS
					<span className="block text-primary">Starter Kit</span>`,
		`${name}
					<span className="block text-primary">Welcome</span>`,
	);
	replaceInFile(
		abs("apps/user-application/src/components/landing/hero-section.tsx"),
		/Ship your SaaS faster.*?next project\./s,
		"Your new project is ready. Start building!",
	);
	replaceInFile(
		abs("apps/user-application/src/components/landing/hero-section.tsx"),
		"Go to Dashboard",
		"Get Started",
	);
	replaceInFile(
		abs("apps/user-application/src/components/landing/hero-section.tsx"),
		'<Link to="/dashboard"',
		'<Link to="/signin"',
	);

	// Landing features heading
	replaceInFile(
		abs("apps/user-application/src/components/landing/features-section.tsx"),
		"Production-Ready SaaS Template",
		"What's Included",
	);

	// ── Step 2: Delete example routes ────────────────────────────────

	console.log("[2/12] Deleting example routes...");
	rmDir(abs("apps/user-application/src/routes/_auth/dashboard"));
	rmDir(abs("apps/user-application/src/routes/_auth/app"));

	// Create placeholder child so _auth layout has at least one route
	fs.writeFileSync(
		abs("apps/user-application/src/routes/_auth/home.tsx"),
		`import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/home")({
	component: HomePage,
});

function HomePage() {
	return (
		<div>
			<h1 className="text-2xl font-bold text-foreground">Home</h1>
			<p className="text-muted-foreground mt-2">Welcome! Start building here.</p>
		</div>
	);
}
`,
		"utf-8",
	);

	// ── Step 3: Delete example server functions & middleware ──────────

	console.log("[3/12] Deleting example server functions & middleware...");
	rmFile(abs("apps/user-application/src/core/functions/example-functions.ts"));
	rmFile(abs("apps/user-application/src/core/middleware/example-middleware.ts"));
	rmDir(abs("apps/user-application/src/core/functions/clients"));

	// ── Step 4: Delete client-related lib files ──────────────────────

	console.log("[4/12] Deleting client lib files...");
	rmFile(abs("apps/user-application/src/lib/query-keys.ts"));
	rmFile(abs("apps/user-application/src/lib/api-client.ts"));

	// ── Step 5: Clean sidebar ────────────────────────────────────────

	console.log("[5/12] Cleaning sidebar...");
	replaceInFile(
		abs("apps/user-application/src/components/layout/sidebar.tsx"),
		`import { Globe, Home, Menu } from "lucide-react";`,
		`import { Home, Menu } from "lucide-react";`,
	);
	replaceInFile(
		abs("apps/user-application/src/components/layout/sidebar.tsx"),
		`const navigationItems: NavigationItem[] = [
	{
		name: "Home",
		icon: Home,
		href: "/",
	},
	{
		name: "Dashboard",
		icon: Globe,
		href: "/dashboard",
	},
];`,
		`const navigationItems: NavigationItem[] = [
	{
		name: "Home",
		icon: Home,
		href: "/home",
	},
];`,
	);

	// ── Step 6: Clean navigation bar ─────────────────────────────────

	console.log("[6/12] Cleaning navigation bar...");

	const navBarPath = abs("apps/user-application/src/components/navigation/navigation-bar.tsx");
	let navBar = fs.readFileSync(navBarPath, "utf-8");

	// Remove Github from import
	navBar = navBar.replace(
		`import { ExternalLink, Github, LogIn, Menu } from "lucide-react";`,
		`import { ExternalLink, LogIn, Menu } from "lucide-react";`,
	);

	// Remove Dashboard from navigationItems
	navBar = navBar.replace(
		`const navigationItems: NavigationItem[] = [
	{ label: "Features", href: "/#features", scrollTo: "features" },
	{ label: "Dashboard", href: "/dashboard" },
];`,
		`const navigationItems: NavigationItem[] = [
	{ label: "Features", href: "/#features", scrollTo: "features" },
];`,
	);

	// Remove desktop GitHub button block
	navBar = navBar.replace(
		`{/* GitHub + Theme Toggle */}
						<div className="ml-2 pl-2 border-l border-border/30 flex items-center gap-1">
							<Button variant="ghost" size="icon" asChild>
								<a
									href="https://github.com/auditmos/saas-on-cf"
									target="_blank"
									rel="noopener noreferrer"
								>
									<Github className="h-4 w-4 text-foreground" />
									<span className="sr-only">GitHub</span>
								</a>
							</Button>
							<ThemeToggle variant="ghost" align="end" />
						</div>`,
		`{/* Theme Toggle */}
						<div className="ml-2 pl-2 border-l border-border/30 flex items-center gap-1">
							<ThemeToggle variant="ghost" align="end" />
						</div>`,
	);

	// Remove mobile GitHub button
	navBar = navBar.replace(
		`<div className="lg:hidden flex items-center space-x-1">
						<Button variant="ghost" size="icon" asChild>
							<a
								href="https://github.com/auditmos/saas-on-cf"
								target="_blank"
								rel="noopener noreferrer"
							>
								<Github className="h-4 w-4 text-foreground" />
								<span className="sr-only">GitHub</span>
							</a>
						</Button>
						<ThemeToggle variant="ghost" align="end" />`,
		`<div className="lg:hidden flex items-center space-x-1">
						<ThemeToggle variant="ghost" align="end" />`,
	);

	fs.writeFileSync(navBarPath, navBar, "utf-8");

	// ── Step 7: Delete client domain (data-ops) ──────────────────────

	console.log("[7/12] Deleting client domain from data-ops...");
	rmDir(abs("packages/data-ops/src/client"));

	// Remove ./client export from data-ops package.json
	const dataOpsPackagePath = abs("packages/data-ops/package.json");
	const dataOpsPkg = JSON.parse(fs.readFileSync(dataOpsPackagePath, "utf-8"));
	delete dataOpsPkg.exports["./client"];
	fs.writeFileSync(dataOpsPackagePath, `${JSON.stringify(dataOpsPkg, null, "\t")}\n`, "utf-8");

	// Remove client table from drizzle configs
	for (const cfg of [
		"drizzle-dev.config.ts",
		"drizzle-staging.config.ts",
		"drizzle-production.config.ts",
	]) {
		replaceInFile(
			abs(`packages/data-ops/${cfg}`),
			`schema: ["./src/drizzle/auth-schema.ts", "./src/client/table.ts", "./src/drizzle/relations.ts"],`,
			`schema: ["./src/drizzle/auth-schema.ts", "./src/drizzle/relations.ts"],`,
		);
	}

	// ── Step 8: Delete migrations ────────────────────────────────────

	console.log("[8/12] Deleting migrations...");
	rmDir(abs("packages/data-ops/src/drizzle/migrations/dev"));
	rmDir(abs("packages/data-ops/src/drizzle/migrations/staging"));
	rmDir(abs("packages/data-ops/src/drizzle/migrations/production"));

	// ── Step 9: Clean seed file ──────────────────────────────────────

	console.log("[9/12] Cleaning seed file...");
	fs.writeFileSync(
		abs("packages/data-ops/src/database/seed/seed.ts"),
		`import { sql } from "drizzle-orm";
import { initDatabase } from "../setup";

async function seedDb() {
	const db = initDatabase({
		host: process.env.DATABASE_HOST!,
		username: process.env.DATABASE_USERNAME!,
		password: process.env.DATABASE_PASSWORD!,
	});
	await db.execute(sql\`SELECT 1\`);
	// Add seed data here
	process.exit(0);
}

seedDb().catch(() => {
	process.exit(1);
});
`,
		"utf-8",
	);

	// ── Step 10: Clean data-service ──────────────────────────────────

	console.log("[10/12] Cleaning data-service...");
	rmFile(abs("apps/data-service/src/hono/handlers/client-handlers.ts"));
	rmFile(abs("apps/data-service/src/hono/services/client-service.ts"));

	// Remove clients route from app.ts
	const appTsPath = abs("apps/data-service/src/hono/app.ts");
	let appTs = fs.readFileSync(appTsPath, "utf-8");
	appTs = appTs.replace(`import clients from "./handlers/client-handlers";\n`, "");
	appTs = appTs.replace(`\nApp.route("/clients", clients);`, "");
	fs.writeFileSync(appTsPath, appTs, "utf-8");

	// ── Step 11: Regenerate route tree ───────────────────────────────

	console.log("[11/12] Regenerating route tree...");
	try {
		execSync("npx @tanstack/router-cli generate", {
			cwd: abs("apps/user-application"),
			stdio: "inherit",
		});
	} catch {
		console.warn(
			"Warning: route tree generation failed. Run manually: cd apps/user-application && npx @tanstack/router-cli generate",
		);
	}

	// ── Step 12: Self-destruct ───────────────────────────────────────

	console.log("[12/12] Cleaning up init script...");

	// Remove init-project script from root package.json
	const rootPkgPath = abs("package.json");
	const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
	delete rootPkg.scripts["init-project"];
	fs.writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, "\t")}\n`, "utf-8");

	// Delete this script
	fs.unlinkSync(abs("scripts/init-project.ts"));

	// Remove scripts dir if empty
	try {
		fs.rmdirSync(abs("scripts"));
	} catch {
		// not empty, leave it
	}

	console.log(`\n✅ Project "${name}" initialized!\n`);
	console.log("Next steps:");
	console.log("  1. Configure env files (see .env examples):");
	console.log("     - packages/data-ops/.env.dev");
	console.log("     - apps/user-application/.env");
	console.log("     - apps/data-service/.dev.vars");
	console.log(
		"  2. Run drizzle migrations: pnpm --filter data-ops drizzle:dev:generate && pnpm --filter data-ops drizzle:dev:migrate",
	);
	console.log("  3. pnpm run dev:data-service");
	console.log("  4. pnpm run dev:user-application");
}

main();
