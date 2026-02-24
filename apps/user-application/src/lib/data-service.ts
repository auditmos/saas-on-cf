import { env } from "cloudflare:workers";

export function fetchDataService(path: string, init?: RequestInit): Promise<Response> {
	return env.DATA_SERVICE.fetch(new Request(`https://data-service${path}`, init));
}
