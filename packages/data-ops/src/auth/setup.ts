import { type BetterAuthOptions, betterAuth } from "better-auth";

export const createBetterAuth = (config: {
	database: BetterAuthOptions["database"];
	secret?: BetterAuthOptions["secret"];
	baseURL?: BetterAuthOptions["baseURL"];
}): ReturnType<typeof betterAuth> => {
	return betterAuth({
		database: config.database,
		secret: config.secret,
		baseURL: config.baseURL,
		emailAndPassword: {
			enabled: true,
		},
		user: {
			modelName: "auth_user",
			additionalFields: {
				approved: {
					type: "boolean",
					required: true,
					defaultValue: false,
					input: false,
				},
			},
		},
		session: {
			modelName: "auth_session",
		},
		verification: {
			modelName: "auth_verification",
		},
		account: {
			modelName: "auth_account",
		},
	});
};
