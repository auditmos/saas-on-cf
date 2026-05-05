import { resolve } from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		name: "test-harness",
		globals: true,
		include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
	},
});
