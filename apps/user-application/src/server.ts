// DO NOT DELETE THIS FILE!!!
// This file is a good smoke test to make sure the custom server entry is working

import { env } from "cloudflare:workers";
import { setAuth } from "@repo/data-ops/auth/server";
import { getDb, initDatabase } from "@repo/data-ops/database/setup";
import handler from "@tanstack/react-start/server-entry";

export default {
	fetch(request: Request) {
		initDatabase({
			host: env.DATABASE_HOST,
			username: env.DATABASE_USERNAME,
			password: env.DATABASE_PASSWORD,
		});

		setAuth({
			secret: env.BETTER_AUTH_SECRET,
			baseURL: env.BETTER_AUTH_BASE_URL,
			adapter: {
				drizzleDb: getDb(),
				provider: "pg",
			},
		});

		return handler.fetch(request, {
			context: {
				fromFetch: true,
			},
		});
	},
};
