import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
	// `upload_source_maps` in wrangler.jsonc can only upload a map that exists,
	// and Vite emits none by default — so the Worker's traces would stay
	// minified however the deploy is configured. Scoped to the server bundle on
	// purpose: turning this on globally would publish the client's sources.
	environments: {
		ssr: {
			build: { sourcemap: true },
		},
	},
	plugins: [
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart({
			srcDirectory: "src",
			start: { entry: "./start.tsx" },
			server: { entry: "./server.ts" },
		}),
		viteReact(),
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
	],
});

export default config;
