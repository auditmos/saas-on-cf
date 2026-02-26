import {
	type Client,
	type ClientCreateInput,
	type ClientListResponse,
	type ClientUpdateInput,
	ErrorResponseSchema,
	type PaginationRequest,
} from "@repo/data-ops/client";
import { AppError } from "@/core/errors";

const API_URL = import.meta.env.VITE_DATA_SERVICE_URL || "http://localhost:8788";
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

const getHeaders = (): HeadersInit => {
	const headers: HeadersInit = { "Content-Type": "application/json" };
	if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
	return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		const parsed = ErrorResponseSchema.safeParse(body);
		const errorData = parsed.success ? parsed.data : {};
		throw new AppError(
			errorData.message || "Request failed",
			errorData.code || "API_ERROR",
			response.status,
		);
	}
	return response.json();
};

// GET Client
export async function fetchClient(id: string): Promise<Client | null> {
	const response = await fetch(`${API_URL}/clients/${id}`, {
		method: "GET",
		headers: getHeaders(),
	});
	if (response.status === 404) return null;
	return handleResponse<Client>(response);
}

// GET Clients (paginated)
export async function fetchClients(params: PaginationRequest): Promise<ClientListResponse> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit ?? 10),
		offset: String(params.offset ?? 0),
	});

	const response = await fetch(`${API_URL}/clients?${searchParams}`, {
		method: "GET",
		headers: getHeaders(),
	});

	return handleResponse<ClientListResponse>(response);
}

// CREATE Client
export async function createClientApi(data: ClientCreateInput): Promise<Client> {
	const response = await fetch(`${API_URL}/clients`, {
		method: "POST",
		headers: getHeaders(),
		body: JSON.stringify(data),
	});

	return handleResponse<Client>(response);
}

// UPDATE Client
export async function updateClientApi(id: string, data: ClientUpdateInput): Promise<Client> {
	const response = await fetch(`${API_URL}/clients/${id}`, {
		method: "PUT",
		headers: getHeaders(),
		body: JSON.stringify(data),
	});

	return handleResponse<Client>(response);
}

// DELETE Client
export async function deleteClientApi(id: string): Promise<void> {
	const response = await fetch(`${API_URL}/clients/${id}`, {
		method: "DELETE",
		headers: getHeaders(),
	});

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		const parsed = ErrorResponseSchema.safeParse(body);
		const errorData = parsed.success ? parsed.data : {};
		throw new AppError(
			errorData.message || "Failed to delete client",
			errorData.code || "API_ERROR",
			response.status,
		);
	}
}
