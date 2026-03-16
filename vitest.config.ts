import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["packages/data-ops", "apps/data-service", "apps/user-application"],
	},
});
