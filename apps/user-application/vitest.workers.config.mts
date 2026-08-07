/**
 * Workers-runtime test project for this app's SERVER-SIDE code.
 *
 * `vitest.config.ts` is the Node project: fast, but it aliases
 * `cloudflare:workers` to a stub, so anything whose behaviour is the runtime's
 * — bindings, isolate-local module state, platform globals — is asserted
 * against a hand-written double rather than the platform.
 *
 * Files named `*.workers.test.ts` run here instead, inside workerd.
 *
 * Bindings are declared inline rather than read from `wrangler.jsonc`: the
 * deployed config points `main` at the TanStack Start server entry, which only
 * builds through the Vite plugin, and points DATA_SERVICE at a Worker that is
 * not deployed during a test run.
 */

import { resolve } from "node:path";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/** Echoes the request it received so tests can assert what crossed the binding. */
async function echoUpstream(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const body = request.method === "GET" || request.method === "HEAD" ? null : await request.text();

	return new Response(
		JSON.stringify({
			origin: url.origin,
			path: url.pathname,
			search: url.search,
			method: request.method,
			body,
			contentType: request.headers.get("content-type"),
		}),
		{ headers: { "Content-Type": "application/json" } },
	);
}

export default defineConfig({
	plugins: [
		cloudflareTest({
			miniflare: {
				compatibilityDate: "2026-05-25",
				compatibilityFlags: ["nodejs_compat"],
				bindings: { CLOUDFLARE_ENV: "dev" },
				serviceBindings: { DATA_SERVICE: echoUpstream },
			},
		}),
	],
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		name: "user-application-workers",
		globals: true,
		include: ["src/**/*.workers.test.ts"],
	},
});
