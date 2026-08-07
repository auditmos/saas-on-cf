import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"packages/data-ops",
			"apps/data-service",
			// The frontend has two projects: Node for pure server-side logic, and
			// workerd for code whose behaviour is the runtime's (bindings,
			// isolate-local state, platform globals).
			"apps/user-application/vitest.config.ts",
			"apps/user-application/vitest.workers.config.mts",
			"scripts",
		],
	},
});
