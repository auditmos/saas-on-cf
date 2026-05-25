import type { LivenessResponse, ReadinessResponse } from "@repo/data-ops/health";
import { Hono } from "hono";
import { checkDatabase } from "../services/health-service";

const health = new Hono<{ Bindings: Env }>();

health.get("/live", (c) => {
	const response: LivenessResponse = {
		status: "ok",
		time: new Date().toISOString(),
	};
	return c.json(response);
});

health.get("/ready", async (c) => {
	const dbStatus = await checkDatabase();
	const response: ReadinessResponse = {
		status: dbStatus === "connected" ? "ok" : "degraded",
		env: c.env.CLOUDFLARE_ENV,
		service: "saas-on-cf",
		time: new Date().toISOString(),
		database: dbStatus,
	};
	return c.json(response, dbStatus === "connected" ? 200 : 503);
});

export default health;
