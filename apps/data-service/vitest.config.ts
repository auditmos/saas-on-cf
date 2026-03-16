import { resolve } from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
