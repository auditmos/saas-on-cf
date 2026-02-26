import { env } from "cloudflare:workers";
import { checkDatabase, type LivenessResponse } from "@repo/data-ops/health";
import { createFileRoute } from "@tanstack/react-router";
import { fetchDataService } from "@/lib/data-service";

interface HealthResponse {
	status: "ok" | "degraded";
	env: string;
	service: string;
	time: string;
	database: string;
	dataServiceBinding: LivenessResponse | { status: "error"; message: string };
}

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				const [dbStatus, dsResult] = await Promise.all([
					checkDatabase(),
					fetchDataService("/health/live")
						.then((r) => r.json() as Promise<LivenessResponse>)
						.catch((e: Error) => ({ status: "error" as const, message: e.message })),
				]);

				const response: HealthResponse = {
					status: dbStatus === "connected" ? "ok" : "degraded",
					env: env.CLOUDFLARE_ENV,
					service: "saas-on-cf-ua",
					time: new Date().toISOString(),
					database: dbStatus,
					dataServiceBinding: dsResult,
				};

				return Response.json(response, {
					status: dbStatus === "connected" ? 200 : 503,
				});
			},
		},
	},
});
