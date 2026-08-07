import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A client-side redirect in a React effect is not access control — it runs
 * after the server has already rendered and returned the content. Keeping one
 * around "as well" is worse than useless: it makes the protected layout look
 * guarded to a reader while the real guard is somewhere else.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const protectedLayout = join(repoRoot, "apps/user-application/src/routes/_auth/route.tsx");

const source = readFileSync(protectedLayout, "utf8");
const sourceFile = ts.createSourceFile(
	"route.tsx",
	source,
	ts.ScriptTarget.Latest,
	true,
	ts.ScriptKind.TSX,
);

function callees(): string[] {
	const names: string[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node)) {
			if (ts.isIdentifier(node.expression)) names.push(node.expression.text);
			else if (ts.isPropertyAccessExpression(node.expression)) {
				names.push(node.expression.name.text);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return names;
}

function hasRouteOption(name: string): boolean {
	let found = false;
	const visit = (node: ts.Node): void => {
		if (
			ts.isPropertyAssignment(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === name &&
			(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
		) {
			found = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return found;
}

describe("the protected layout has no client-side redirect", () => {
	it("runs its session check on the server, in beforeLoad", () => {
		expect(
			hasRouteOption("beforeLoad"),
			"/_auth declares no beforeLoad, so nothing checks the session before the server renders the protected content",
		).toBe(true);
	});

	it("uses no React effect at all", () => {
		expect(
			callees().filter((name) => name === "useEffect" || name === "useLayoutEffect"),
			"the protected layout still redirects from an effect — that check runs after the server has already returned the content",
		).toEqual([]);
	});

	it("does not decide access from a client-side session hook", () => {
		expect(
			callees().filter((name) => name === "useSession"),
			"the layout reads the session on the client to decide access; the server-side guard is the authority",
		).toEqual([]);
	});
});
