import {
	type Client,
	type ClientCreateInput,
	type ClientListResponse,
	type ClientUpdateInput,
	createClient as createClientQuery,
	deleteClient as deleteClientQuery,
	getClient,
	getClients as getClientsQuery,
	type PaginationRequest,
	updateClient as updateClientQuery,
} from "@repo/data-ops/client";
import type { Result } from "../types/result";

function isUniqueViolation(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const cause = error.cause;
	if (cause instanceof Error) {
		const pgCode = (cause as Error & { code?: string }).code;
		if (pgCode === "23505") return true;
	}
	return false;
}

export async function getClients(params: PaginationRequest): Promise<Result<ClientListResponse>> {
	const data = await getClientsQuery(params);
	return { ok: true, data };
}

export async function getClientById(id: string): Promise<Result<Client>> {
	const client = await getClient(id);
	if (!client)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Client not found", status: 404 },
		};
	return { ok: true, data: client };
}

export async function createClient(data: ClientCreateInput): Promise<Result<Client>> {
	try {
		const client = await createClientQuery(data);
		return { ok: true, data: client };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return {
				ok: false,
				error: {
					code: "CONFLICT",
					message: "Email already exists",
					status: 409,
				},
			};
		}
		throw error;
	}
}

export async function updateClient(id: string, data: ClientUpdateInput): Promise<Result<Client>> {
	try {
		const client = await updateClientQuery(id, data);
		if (!client)
			return {
				ok: false,
				error: {
					code: "NOT_FOUND",
					message: "Client not found",
					status: 404,
				},
			};
		return { ok: true, data: client };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return {
				ok: false,
				error: {
					code: "CONFLICT",
					message: "Email already exists",
					status: 409,
				},
			};
		}
		throw error;
	}
}

export async function deleteClient(id: string): Promise<Result<null>> {
	const deleted = await deleteClientQuery(id);
	if (!deleted)
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Client not found", status: 404 },
		};
	return { ok: true, data: null };
}
