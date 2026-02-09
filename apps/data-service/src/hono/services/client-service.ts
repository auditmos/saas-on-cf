import type {
  Client,
  ClientCreateInput,
  ClientUpdateInput,
  PaginationRequest,
  ClientListResponse
} from '@repo/data-ops/zod-schema/client';
import {
  getClient,
  getClients as getClientsQuery,
  createClient as createClientQuery,
  updateClient as updateClientQuery,
  deleteClient as deleteClientQuery
} from '@repo/data-ops/queries/client';
import { HTTPException } from 'hono/http-exception';

export async function getClients(params: PaginationRequest): Promise<ClientListResponse> {
  return getClientsQuery(params);
}

export async function getClientById(id: string): Promise<Client> {
  const client = await getClient(id);
  if (!client) throw new HTTPException(404, { message: 'Client not found' });
  return client;
}

export async function createClient(data: ClientCreateInput): Promise<Client> {
  try {
    return await createClientQuery(data);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      throw new HTTPException(409, { message: 'Email already exists' });
    }
    throw error;
  }
}

export async function updateClient(id: string, data: ClientUpdateInput): Promise<Client> {
  try {
    const client = await updateClientQuery(id, data);
    if (!client) throw new HTTPException(404, { message: 'Client not found' });
    return client;
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      throw new HTTPException(409, { message: 'Email already exists' });
    }
    throw error;
  }
}

export async function deleteClient(id: string): Promise<void> {
  const deleted = await deleteClientQuery(id);
  if (!deleted) throw new HTTPException(404, { message: 'Client not found' });
}
