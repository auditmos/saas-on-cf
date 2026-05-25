import { getAuth } from "@repo/data-ops/auth/server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			ANY: ({ request }) => {
				const auth = getAuth();
				return auth.handler(request);
			},
		},
	},
});
