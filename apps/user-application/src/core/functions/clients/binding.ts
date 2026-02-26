import { env } from "cloudflare:workers";
import {
	type Client,
	type ClientCreateInput,
	ClientCreateRequestSchema,
	type ClientListResponse,
	ClientListResponseSchema,
	ClientSchema,
	ClientUpdateRequestSchema,
	PaginationRequestSchema,
} from "@repo/data-ops/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppError } from "@/core/errors";

interface ErrorBody {
	message?: string;
	code?: string;
}

const makeBindingRequest = async (path: string, options: RequestInit = {}) => {
	return env.DATA_SERVICE.fetch(
		new Request(`https://data-service${path}`, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
				...options.headers,
			},
			...options,
		}),
	);
};

async function throwOnError(response: Response, fallbackMessage: string): Promise<never> {
	const body = (await response.json().catch(() => ({}))) as ErrorBody;
	throw new AppError(body.message || fallbackMessage, body.code || "API_ERROR", response.status);
}

// GET Client
const GetClientInput = z.object({ id: z.string().min(1) });

export const getClientBinding = createServerFn()
	.inputValidator((data: z.infer<typeof GetClientInput>) => GetClientInput.parse(data))
	.handler(async (ctx): Promise<Client | null> => {
		const response = await makeBindingRequest(`/clients/${ctx.data.id}`);
		if (response.status === 404) return null;
		if (!response.ok) await throwOnError(response, "Failed to fetch client");
		return ClientSchema.parse(await response.json());
	});

// GET Clients (paginated)
export const getClientsBinding = createServerFn()
	.inputValidator((data: z.infer<typeof PaginationRequestSchema>) =>
		PaginationRequestSchema.parse(data),
	)
	.handler(async (ctx): Promise<ClientListResponse> => {
		const params = new URLSearchParams({
			limit: String(ctx.data.limit),
			offset: String(ctx.data.offset),
		});
		const response = await makeBindingRequest(`/clients?${params}`);
		if (!response.ok) await throwOnError(response, "Failed to fetch clients");
		return ClientListResponseSchema.parse(await response.json());
	});

// CREATE Client
export const createClientBinding = createServerFn({ method: "POST" })
	.inputValidator((data: unknown): ClientCreateInput => ClientCreateRequestSchema.parse(data))
	.handler(async (ctx): Promise<Client> => {
		const response = await makeBindingRequest("/clients", {
			method: "POST",
			body: JSON.stringify(ctx.data),
		});

		if (!response.ok) await throwOnError(response, "Failed to create client");
		return ClientSchema.parse(await response.json());
	});

// UPDATE Client
const UpdateClientInput = z.object({
	id: z.string().min(1),
	data: ClientUpdateRequestSchema,
});

export const updateClientBinding = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => UpdateClientInput.parse(data))
	.handler(async (ctx): Promise<Client> => {
		const { id, data: updateData } = ctx.data;

		const response = await makeBindingRequest(`/clients/${id}`, {
			method: "PUT",
			body: JSON.stringify(updateData),
		});

		if (!response.ok) await throwOnError(response, "Failed to update client");
		return ClientSchema.parse(await response.json());
	});

// DELETE Client
const DeleteClientInput = z.object({ id: z.string().min(1) });

export const deleteClientBinding = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => DeleteClientInput.parse(data))
	.handler(async (ctx): Promise<void> => {
		const response = await makeBindingRequest(`/clients/${ctx.data.id}`, {
			method: "DELETE",
		});

		if (!response.ok) await throwOnError(response, "Failed to delete client");
	});
