import { checkDatabase as checkDatabaseQuery, type DatabaseStatus } from "@repo/data-ops/health";

export async function checkDatabase(): Promise<DatabaseStatus> {
	return checkDatabaseQuery();
}
