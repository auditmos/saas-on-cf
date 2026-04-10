import { defineProject } from "vitest/config";
import { resolve } from "node:path";

export default defineProject({
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		name: "test-harness",
		globals: true,
		include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
	},
});
