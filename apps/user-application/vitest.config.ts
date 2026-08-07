import { resolve } from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "src"),
			// Server-side modules import `env` from the Workers virtual module. Outside
			// the Workers runtime it does not resolve, so tests get a mutable stub.
			"cloudflare:workers": resolve(import.meta.dirname, "src/test/cloudflare-workers.ts"),
		},
	},
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
		exclude: ["src/routes/**"],
	},
});
