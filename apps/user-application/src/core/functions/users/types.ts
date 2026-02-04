import type { User } from '@repo/data-ops/zod-schema/user';

export interface MutationSuccess {
  success: true;
  user: User;
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
