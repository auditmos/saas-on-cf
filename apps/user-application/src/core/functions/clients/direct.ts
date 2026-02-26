import {
	type Client,
	type ClientCreateInput,
	ClientCreateRequestSchema,
	type ClientListResponse,
	ClientSchema,
	ClientUpdateRequestSchema,
	createClient,
	deleteClient,
	getClient,
	getClients,
	PaginationRequestSchema,
	updateClient,
} from "@repo/data-ops/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeleteResult, MutationResult } from "./types";

// GET Client
const GetClientInput = z.object({ id: z.string().min(1) });

export const getClientDirect = createServerFn()
	.inputValidator((data: z.infer<typeof GetClientInput>) => GetClientInput.parse(data))
	.handler(async (ctx): Promise<Client | null> => {
		const client = await getClient(ctx.data.id);
		return client ? ClientSchema.parse(client) : null;
	});

// GET Clients (paginated)
export const getClientsDirect = createServerFn()
	.inputValidator((data: z.infer<typeof PaginationRequestSchema>) =>
		PaginationRequestSchema.parse(data),
	)
	.handler(async (ctx): Promise<ClientListResponse> => {
		return getClients(ctx.data);
	});

// CREATE Client
export const createClientDirect = createServerFn({ method: "POST" })
	.inputValidator((data: unknown): ClientCreateInput => ClientCreateRequestSchema.parse(data))
	.handler(async (ctx): Promise<MutationResult> => {
		try {
			const client = await createClient(ctx.data);
			return { success: true, client: ClientSchema.parse(client) };
		} catch (error) {
			if (error instanceof Error && error.message.includes("duplicate")) {
				return {
					success: false,
					error: "Email already exists",
					code: "EMAIL_EXISTS",
					field: "email",
				};
			}
			return { success: false, error: "Failed to create client", code: "UNKNOWN" };
		}
	});

// UPDATE Client
const UpdateClientInput = z.object({
	id: z.string().min(1),
	data: ClientUpdateRequestSchema,
});

export const updateClientDirect = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => UpdateClientInput.parse(data))
	.handler(async (ctx): Promise<MutationResult> => {
		const { id, data: updateData } = ctx.data;

		try {
			const targetClient = await getClient(id);
			if (!targetClient) {
				return { success: false, error: "Client not found", code: "NOT_FOUND" };
			}

			const updated = await updateClient(id, updateData);
			if (!updated) {
				return { success: false, error: "Failed to update client", code: "UPDATE_FAILED" };
			}

			return { success: true, client: ClientSchema.parse(updated) };
		} catch (error) {
			if (error instanceof Error && error.message === "EMAIL_EXISTS") {
				return {
					success: false,
					error: "Email already in use",
					code: "EMAIL_EXISTS",
					field: "email",
				};
			}
			return { success: false, error: "Failed to update client", code: "UNKNOWN" };
		}
	});

// DELETE Client
const DeleteClientInput = z.object({ id: z.string().min(1) });

export const deleteClientDirect = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => DeleteClientInput.parse(data))
	.handler(async (ctx): Promise<DeleteResult> => {
		const { id } = ctx.data;

		const targetClient = await getClient(id);
		if (!targetClient) {
			return { success: false, error: "Client not found", code: "NOT_FOUND" };
		}

		const deleted = await deleteClient(id);
		if (!deleted) {
			return { success: false, error: "Failed to delete client", code: "DELETE_FAILED" };
		}

		return { success: true };
	});
