/**
 * Runs in the Workers runtime (`vitest.workers.config.mts`), not in Node.
 *
 * `data-service.ts` imports `env` from `cloudflare:workers` and dispatches over
 * a service binding. The Node project cannot exercise either: it aliases
 * `cloudflare:workers` to a hand-written stub, so the binding hop it asserts on
 * is the stub's, never the platform's. Here the module resolves for real and
 * the request crosses an actual service binding.
 */

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fetchDataService } from "./data-service";

interface EchoedRequest {
	origin: string;
	path: string;
	search: string;
	method: string;
	body: string | null;
	contentType: string | null;
}

const echoed = (response: Response): Promise<EchoedRequest> =>
	response.json() as Promise<EchoedRequest>;

describe("the harness itself", () => {
	it("executes in workerd, not in Node", () => {
		// The guardrail this whole project exists for. If it ever reads as Node,
		// every other assertion below is being made against the wrong runtime.
		expect(navigator.userAgent).toBe("Cloudflare-Workers");
		expect(typeof WebSocketPair).toBe("function");
	});

	it("resolves cloudflare:workers as the real virtual module, not a test double", () => {
		expect(env.DATA_SERVICE).toBeDefined();
		expect(typeof env.DATA_SERVICE.fetch).toBe("function");
	});
});

describe("fetchDataService", () => {
	it("dispatches the path over the DATA_SERVICE service binding", async () => {
		const result = await echoed(await fetchDataService("/health/live"));

		expect(result.origin).toBe("https://data-service");
		expect(result.path).toBe("/health/live");
		expect(result.method).toBe("GET");
	});

	it("preserves the query string", async () => {
		const result = await echoed(await fetchDataService("/clients?limit=5&offset=10"));

		expect(result.path).toBe("/clients");
		expect(result.search).toBe("?limit=5&offset=10");
	});

	it("carries method, body and headers across the binding hop", async () => {
		const result = await echoed(
			await fetchDataService("/clients", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Ada" }),
			}),
		);

		expect(result.method).toBe("POST");
		expect(result.contentType).toBe("application/json");
		expect(result.body).toBe(JSON.stringify({ name: "Ada" }));
	});
});
