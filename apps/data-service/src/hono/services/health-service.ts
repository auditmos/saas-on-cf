import type { DatabaseStatus } from '@repo/data-ops/zod-schema/health';
import { checkDatabase as checkDatabaseQuery } from '@repo/data-ops/queries/health';

export async function checkDatabase(): Promise<DatabaseStatus> {
  return checkDatabaseQuery();
}
