import type { Client } from "@repo/data-ops/client";

export interface MutationSuccess {
	success: true;
	client: Client;
}

export interface MutationError {
	success: false;
	error: string;
	code: string;
	field?: string;
}

export type MutationResult = MutationSuccess | MutationError;

export interface DeleteSuccess {
	success: true;
}

export type DeleteResult = DeleteSuccess | MutationError;
