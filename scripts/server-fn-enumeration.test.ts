import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PUBLIC_SERVER_FNS } from "../apps/user-application/src/core/public-server-fns";

/**
 * Discovers every exported server function in the frontend app and fails if any
 * is neither protected by the default boundary nor carrying the explicit public
 * marker.
 *
 * The app is default-closed: `startInstance` registers the auth check as global
 * `functionMiddleware`, so a function is protected unless it is listed in
 * PUBLIC_SERVER_FNS. That makes two things load-bearing, and both are asserted
 * here: the global wiring must exist, and the public list must match the list a
 * reviewer signed off on.
 *
 * Parsed with the TypeScript AST rather than grepped, because the dashboard
 * demo pages contain `createServerFn` inside template-literal code samples that
 * a regex would report as real endpoints.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const appRoot = join(repoRoot, "apps", "user-application");
const appSrc = join(appRoot, "src");

const SKIP_DIRS = new Set([
	"node_modules",
	".wrangler",
	"dist",
	"coverage",
	".tanstack",
	".output",
]);

interface DiscoveredServerFn {
	/** Path relative to the app root, matching what the Start compiler reports. */
	filename: string;
	name: string;
}

function sourceFiles(dir: string, results: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) sourceFiles(full, results);
		else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) results.push(full);
	}
	return results;
}

/** Walks `a.b().c()` down to the identifier it is rooted at. */
function chainRoot(expr: ts.Node): string | undefined {
	let current = expr;
	while (true) {
		if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
			current = current.expression;
			continue;
		}
		return ts.isIdentifier(current) ? current.text : undefined;
	}
}

/** True when the chain terminates a server function rather than building a base. */
function chainCallsHandler(expr: ts.Node): boolean {
	let current = expr;
	while (true) {
		if (ts.isCallExpression(current)) {
			if (
				ts.isPropertyAccessExpression(current.expression) &&
				current.expression.name.text === "handler"
			) {
				return true;
			}
			current = current.expression;
			continue;
		}
		if (ts.isPropertyAccessExpression(current)) {
			current = current.expression;
			continue;
		}
		return false;
	}
}

function parse(absPath: string): ts.SourceFile {
	return ts.createSourceFile(
		absPath,
		readFileSync(absPath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		absPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
}

/** Local names bound to `createServerFn` by an import in this file. */
function importedFactoryNames(sf: ts.SourceFile): Set<string> {
	const names = new Set<string>();
	for (const node of sf.statements) {
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
		if (node.moduleSpecifier.text !== "@tanstack/react-start") continue;
		const bindings = node.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) continue;
		for (const element of bindings.elements) {
			if ((element.propertyName ?? element.name).text === "createServerFn") {
				names.add(element.name.text);
			}
		}
	}
	return names;
}

interface Declaration {
	name: string;
	exported: boolean;
	initializer: ts.Expression;
}

function topLevelDeclarations(sf: ts.SourceFile): Declaration[] {
	const declarations: Declaration[] = [];
	for (const node of sf.statements) {
		if (!ts.isVariableStatement(node)) continue;
		const exported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
		for (const decl of node.declarationList.declarations) {
			if (!decl.initializer || !ts.isIdentifier(decl.name)) continue;
			declarations.push({ name: decl.name.text, exported, initializer: decl.initializer });
		}
	}
	return declarations;
}

function discoverInFile(absPath: string): DiscoveredServerFn[] {
	const sf = parse(absPath);
	const factoryNames = importedFactoryNames(sf);
	if (factoryNames.size === 0) return [];

	const declarations = topLevelDeclarations(sf);

	// A declaration rooted at the factory that does not call .handler() is a
	// reusable base — `const base = createServerFn().middleware([...])`. Fold
	// those in first so functions built off them are still discovered, whichever
	// order they appear in.
	// Repeated to a fixed point so a base built off another base is folded in
	// regardless of the order the two are declared.
	let grew = true;
	while (grew) {
		const before = factoryNames.size;
		for (const declaration of declarations) {
			const root = chainRoot(declaration.initializer);
			if (root && factoryNames.has(root) && !chainCallsHandler(declaration.initializer)) {
				factoryNames.add(declaration.name);
			}
		}
		grew = factoryNames.size > before;
	}

	const filename = relative(appRoot, absPath).split(sep).join("/");
	return declarations
		.filter((declaration) => {
			if (!declaration.exported || !chainCallsHandler(declaration.initializer)) return false;
			const root = chainRoot(declaration.initializer);
			return root !== undefined && factoryNames.has(root);
		})
		.map((declaration) => ({ filename, name: declaration.name }));
}

const discovered = sourceFiles(appSrc).flatMap(discoverInFile);
const identity = (fn: { filename: string; name: string }) => `${fn.filename}#${fn.name}`;

/**
 * The reviewed public surface. Every addition here is a deliberate decision to
 * let anonymous callers on the internet reach an endpoint — this list exists so
 * that decision cannot be made without a reviewer seeing this test change.
 */
const REVIEWED_PUBLIC_SERVER_FNS: readonly string[] = [
	// Returns only the caller's own session state so the protected layout's
	// server-side guard can decide whether to redirect. An anonymous caller must
	// reach it to be told they are signed out; it discloses nothing else.
	"src/core/functions/auth/session.ts#getAuthView",
];

describe("server-function enumeration guardrail", () => {
	it("discovers the exported server functions (the scanner is not silently finding nothing)", () => {
		expect(discovered.length).toBeGreaterThan(0);
	});

	it("ignores createServerFn appearing inside documentation code samples", () => {
		// The dashboard demo pages print server-function source in <pre> blocks.
		const routeHits = discovered.filter((fn) => fn.filename.startsWith("src/routes/"));
		expect(
			routeHits.map(identity),
			"a server function was found under src/routes — confirm it is real and not a code sample",
		).toEqual([]);
	});

	it("registers the auth boundary as global functionMiddleware, so every function is closed by default", () => {
		const startFile = readFileSync(join(appSrc, "start.tsx"), "utf8");
		const sf = ts.createSourceFile(
			"start.tsx",
			startFile,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);

		let wired = false;
		const visit = (node: ts.Node): void => {
			if (
				ts.isPropertyAssignment(node) &&
				ts.isIdentifier(node.name) &&
				node.name.text === "functionMiddleware" &&
				ts.isArrayLiteralExpression(node.initializer)
			) {
				wired = node.initializer.elements.some(
					(el) => ts.isIdentifier(el) && el.text === "protectedFunctionMiddleware",
				);
			}
			ts.forEachChild(node, visit);
		};
		visit(sf);

		expect(
			wired,
			"src/start.tsx no longer registers protectedFunctionMiddleware as global functionMiddleware — every server function in the app is now reachable anonymously",
		).toBe(true);
	});

	it("uses exactly one Start instance, so no function escapes the global middleware", () => {
		const instances = sourceFiles(appSrc).filter((file) => {
			const sf = ts.createSourceFile(
				file,
				readFileSync(file, "utf8"),
				ts.ScriptTarget.Latest,
				true,
				file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
			);
			let found = false;
			const visit = (node: ts.Node): void => {
				if (
					ts.isCallExpression(node) &&
					ts.isIdentifier(node.expression) &&
					node.expression.text === "createStart"
				) {
					found = true;
				}
				ts.forEachChild(node, visit);
			};
			visit(sf);
			return found;
		});

		expect(instances.map((f) => relative(appRoot, f).split(sep).join("/"))).toEqual([
			"src/start.tsx",
		]);
	});

	it("finds the whole client-facing surface of both data-access strategies", () => {
		const clientFacing = discovered.map(identity).filter((id) => id.includes("/clients/"));
		expect(clientFacing.sort()).toEqual(
			[
				"src/core/functions/clients/direct.ts#getClientDirect",
				"src/core/functions/clients/direct.ts#getClientsDirect",
				"src/core/functions/clients/direct.ts#createClientDirect",
				"src/core/functions/clients/direct.ts#updateClientDirect",
				"src/core/functions/clients/direct.ts#deleteClientDirect",
				"src/core/functions/clients/binding.ts#getClientBinding",
				"src/core/functions/clients/binding.ts#getClientsBinding",
				"src/core/functions/clients/binding.ts#createClientBinding",
				"src/core/functions/clients/binding.ts#updateClientBinding",
				"src/core/functions/clients/binding.ts#deleteClientBinding",
			].sort(),
		);
	});

	it("finds server functions declared through an intermediate base, not only direct chains", () => {
		// example-functions.ts builds `const base = createServerFn().middleware([...])`
		// and exports the handler off that base. A scanner that only matched
		// `createServerFn(...).handler(...)` would miss it — and miss the same
		// pattern used to hide a real endpoint.
		expect(discovered.map(identity)).toContain(
			"src/core/functions/example-functions.ts#examplefunction",
		);
	});

	it("fails when a function is exposed without review", () => {
		const publicIds = PUBLIC_SERVER_FNS.map(identity);
		const unreviewed = publicIds.filter((id) => !REVIEWED_PUBLIC_SERVER_FNS.includes(id));
		expect(
			unreviewed,
			"a server function is marked public but is not in the reviewed list — it is reachable by anonymous callers on the internet",
		).toEqual([]);
	});

	it("exposes only the public functions a reviewer signed off on", () => {
		expect(
			PUBLIC_SERVER_FNS.map(identity).sort(),
			"PUBLIC_SERVER_FNS changed — an endpoint was opened to or closed from anonymous callers. Update REVIEWED_PUBLIC_SERVER_FNS in this test only after confirming the change is intended.",
		).toEqual([...REVIEWED_PUBLIC_SERVER_FNS].sort());
	});

	it("has no stale public entry pointing at a function that does not exist", () => {
		const stale = PUBLIC_SERVER_FNS.filter(
			(entry) => !discovered.some((fn) => identity(fn) === identity(entry)),
		);
		expect(
			stale.map(identity),
			"a PUBLIC_SERVER_FNS entry does not match any exported server function — it is silently doing nothing, and the endpoint it was meant to open may be named differently",
		).toEqual([]);
	});

	it("requires every public entry to state why it is public", () => {
		const unjustified = PUBLIC_SERVER_FNS.filter((entry) => !entry.reason?.trim());
		expect(unjustified.map(identity)).toEqual([]);
	});

	it("grants public access from exactly one place in production code", () => {
		const callers = sourceFiles(appSrc).filter((file) =>
			readFileSync(file, "utf8").includes("isPublicServerFn("),
		);
		expect(
			callers.map((f) => relative(appRoot, f).split(sep).join("/")).sort(),
			"the public-marker check is consulted somewhere new — every additional call site is another way to bypass authentication",
		).toEqual(["src/core/middleware/auth.ts", "src/core/public-server-fns.ts"]);
	});
});
