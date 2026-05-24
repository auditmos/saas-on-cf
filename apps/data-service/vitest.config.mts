import { resolve } from "node:path";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc", environment: "dev" },
		}),
	],
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
