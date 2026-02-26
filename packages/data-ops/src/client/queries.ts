import { count, eq } from "drizzle-orm";
import { getDb } from "@/database/setup";
import type {
	Client,
	ClientCreateInput,
	ClientListResponse,
	ClientUpdateInput,
	PaginationRequest,
} from "./schema";
import { clients } from "./table";

export async function getClient(clientId: string): Promise<Client | null> {
	const db = getDb();
	const result = await db.select().from(clients).where(eq(clients.id, clientId));
	return result[0] ?? null;
}

export async function getClients(params: PaginationRequest): Promise<ClientListResponse> {
	const db = getDb();
	const [data, countResult] = await Promise.all([
		db.select().from(clients).limit(params.limit).offset(params.offset),
		db.select({ total: count() }).from(clients),
	]);
	const total = countResult[0]?.total ?? 0;
	return {
		data,
		pagination: {
			total,
			limit: params.limit,
			offset: params.offset,
			hasMore: params.offset + data.length < total,
		},
	};
}

export async function createClient(data: ClientCreateInput): Promise<Client> {
	const db = getDb();
	const [client] = await db.insert(clients).values(data).returning();
	return client!;
}

export async function updateClient(
	clientId: string,
	data: ClientUpdateInput,
): Promise<Client | null> {
	const db = getDb();
	const result = await db.update(clients).set(data).where(eq(clients.id, clientId)).returning();
	return result[0] ?? null;
}

export async function deleteClient(clientId: string): Promise<boolean> {
	const db = getDb();
	const result = await db.delete(clients).where(eq(clients.id, clientId)).returning();
	return result.length > 0;
}
