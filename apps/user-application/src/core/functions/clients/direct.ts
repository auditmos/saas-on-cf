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
import { AppError } from "@/core/errors";

function isUniqueViolation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const cause = error.cause;
	if (cause instanceof Error) {
		const pgCode = (cause as Error & { code?: string }).code;
		if (pgCode === "23505") return true;
	}
	return false;
}

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
	.handler(async (ctx): Promise<Client> => {
		try {
			const client = await createClient(ctx.data);
			return ClientSchema.parse(client);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new AppError("Email already exists", "EMAIL_EXISTS", 409, "email");
			}
			throw new AppError("Failed to create client", "UNKNOWN", 500);
		}
	});

// UPDATE Client
const UpdateClientInput = z.object({
	id: z.string().min(1),
	data: ClientUpdateRequestSchema,
});

export const updateClientDirect = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => UpdateClientInput.parse(data))
	.handler(async (ctx): Promise<Client> => {
		const { id, data: updateData } = ctx.data;

		try {
			const targetClient = await getClient(id);
			if (!targetClient) {
				throw new AppError("Client not found", "NOT_FOUND", 404);
			}

			const updated = await updateClient(id, updateData);
			if (!updated) {
				throw new AppError("Failed to update client", "UPDATE_FAILED", 500);
			}

			return ClientSchema.parse(updated);
		} catch (error) {
			if (error instanceof AppError) throw error;
			if (isUniqueViolation(error)) {
				throw new AppError("Email already in use", "EMAIL_EXISTS", 409, "email");
			}
			throw new AppError("Failed to update client", "UNKNOWN", 500);
		}
	});

// DELETE Client
const DeleteClientInput = z.object({ id: z.string().min(1) });

export const deleteClientDirect = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => DeleteClientInput.parse(data))
	.handler(async (ctx): Promise<void> => {
		const { id } = ctx.data;

		const targetClient = await getClient(id);
		if (!targetClient) {
			throw new AppError("Client not found", "NOT_FOUND", 404);
		}

		const deleted = await deleteClient(id);
		if (!deleted) {
			throw new AppError("Failed to delete client", "DELETE_FAILED", 500);
		}
	});
