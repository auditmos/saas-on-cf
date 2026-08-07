/**
 * Test double for the `cloudflare:workers` virtual module.
 *
 * `vitest.config.ts` aliases `cloudflare:workers` to this file so that
 * server-side modules importing `env` are loadable outside the Workers runtime.
 * Tests mutate `env` directly — see `resetTestEnv`.
 */

export interface TestEnv {
	DATA_SERVICE: { fetch: (request: Request) => Promise<Response> };
	DATA_SERVICE_API_TOKEN: string;
	[key: string]: unknown;
}

const defaults = (): TestEnv => ({
	DATA_SERVICE: {
		fetch: async () => {
			throw new Error(
				"DATA_SERVICE.fetch was called without a test stub — the upstream service binding must not be reached unexpectedly",
			);
		},
	},
	DATA_SERVICE_API_TOKEN: "test-privileged-upstream-token",
});

export const env: TestEnv = defaults();

export function resetTestEnv(): void {
	for (const key of Object.keys(env)) delete env[key];
	Object.assign(env, defaults());
}
