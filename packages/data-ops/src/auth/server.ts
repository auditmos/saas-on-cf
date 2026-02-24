import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createBetterAuth } from "@/auth/setup";
import type { getDb } from "@/database/setup";
import { auth_account, auth_session, auth_user, auth_verification } from "@/drizzle/auth-schema";

let betterAuth: ReturnType<typeof createBetterAuth>;

export function setAuth(
	config: Omit<Parameters<typeof createBetterAuth>[0], "database"> & {
		adapter: {
			drizzleDb: ReturnType<typeof getDb>;
			provider: Parameters<typeof drizzleAdapter>[1]["provider"];
		};
	},
) {
	betterAuth = createBetterAuth({
		database: drizzleAdapter(config.adapter.drizzleDb, {
			provider: config.adapter.provider,
			schema: {
				auth_user,
				auth_account,
				auth_session,
				auth_verification,
			},
		}),
		...config,
	});
	return betterAuth;
}

export function getAuth() {
	if (!betterAuth) {
		throw new Error("Auth not initialized");
	}
	return betterAuth;
}
