import { zValidator } from "@hono/zod-validator";
import {
	ClientCreateRequestSchema,
	ClientUpdateRequestSchema,
	IdParamSchema,
	PaginationRequestSchema,
} from "@repo/data-ops/zod-schema/client";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import * as clientService from "../services/client-service";

const clients = new Hono<{ Bindings: Env }>();

clients.get("/", zValidator("query", PaginationRequestSchema), async (c) => {
	const query = c.req.valid("query");
	return c.json(await clientService.getClients(query));
});

clients.get("/:id", zValidator("param", IdParamSchema), async (c) => {
	const { id } = c.req.valid("param");
	return c.json(await clientService.getClientById(id));
});

clients.post(
	"/",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("json", ClientCreateRequestSchema),
	async (c) => {
		const data = c.req.valid("json");
		return c.json(await clientService.createClient(data), 201);
	},
);

clients.put(
	"/:id",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", IdParamSchema),
	zValidator("json", ClientUpdateRequestSchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const data = c.req.valid("json");
		return c.json(await clientService.updateClient(id, data));
	},
);

clients.delete(
	"/:id",
	(c, next) => authMiddleware(c.env.API_TOKEN)(c, next),
	zValidator("param", IdParamSchema),
	async (c) => {
		const { id } = c.req.valid("param");
		await clientService.deleteClient(id);
		return c.body(null, 204);
	},
);

export default clients;
