import { zValidator } from "@hono/zod-validator";
import { getAuth } from "@repo/data-ops/auth/server";
import {
	ClientCreateRequestSchema,
	ClientUpdateRequestSchema,
	IdParamSchema,
	PaginationRequestSchema,
} from "@repo/data-ops/client";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { rateLimiter } from "../middleware/rate-limiter";
import { sessionAuth } from "../middleware/session-auth";
import * as clientService from "../services/client-service";
import type { Result } from "../types/result";

function resultToResponse<T>(
	c: Context,
	result: Result<T>,
	successStatus: ContentfulStatusCode = 200,
) {
	if (!result.ok)
		return c.json(
			{ error: result.error.message, code: result.error.code },
			result.error.status as ContentfulStatusCode,
		);
	return c.json(result.data, successStatus);
}

const requireSession = (c: Context<{ Bindings: Env }>, next: () => Promise<void>) =>
	sessionAuth({
		bearer: c.env.API_TOKEN,
		getSession: (req) => getAuth().api.getSession({ headers: req.headers }),
	})(c, next);

const mutationRateLimit = rateLimiter({ binding: "RATE_LIMITER", limit: 10, window: 60 });

const clients = new Hono<{ Bindings: Env }>();

// Mutations are metered ahead of the session check so an unauthenticated flood
// is turned away without spending a session lookup on every request.
clients.on(["POST", "PUT", "DELETE"], "*", mutationRateLimit);

// Fail closed: every route on this router needs a session cookie or the
// service-to-service bearer — including reads, and including routes added
// later. Client names and email addresses are not anonymously enumerable.
clients.use("*", requireSession);

clients.get("/", zValidator("query", PaginationRequestSchema), async (c) => {
	const query = c.req.valid("query");
	return resultToResponse(c, await clientService.getClients(query));
});

clients.get("/:id", zValidator("param", IdParamSchema), async (c) => {
	const { id } = c.req.valid("param");
	return resultToResponse(c, await clientService.getClientById(id));
});

clients.post("/", zValidator("json", ClientCreateRequestSchema), async (c) => {
	const data = c.req.valid("json");
	return resultToResponse(c, await clientService.createClient(data), 201);
});

clients.put(
	"/:id",
	zValidator("param", IdParamSchema),
	zValidator("json", ClientUpdateRequestSchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const data = c.req.valid("json");
		return resultToResponse(c, await clientService.updateClient(id, data));
	},
);

clients.delete("/:id", zValidator("param", IdParamSchema), async (c) => {
	const { id } = c.req.valid("param");
	const result = await clientService.deleteClient(id);
	if (!result.ok)
		return c.json(
			{ error: result.error.message, code: result.error.code },
			result.error.status as ContentfulStatusCode,
		);
	return c.body(null, 204);
});

export default clients;
