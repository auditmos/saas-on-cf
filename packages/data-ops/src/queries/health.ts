import { sql } from 'drizzle-orm';
import { getDb } from '../database/setup';
import type { DatabaseStatus } from '../zod-schema/health';

export async function checkDatabase(): Promise<DatabaseStatus> {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return 'connected';
  } catch {
    return 'disconnected';
  }
}
