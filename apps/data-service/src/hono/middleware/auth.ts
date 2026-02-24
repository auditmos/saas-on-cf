import { bearerAuth } from "hono/bearer-auth";

export const authMiddleware = (token: string) =>
	bearerAuth({
		token,
		noAuthenticationHeaderMessage: "Authorization header required",
		invalidAuthenticationHeaderMessage: "Invalid authorization header format",
		invalidTokenMessage: "Invalid API key",
	});
