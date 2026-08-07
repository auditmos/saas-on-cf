import { createStart } from "@tanstack/react-start";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

declare module "@tanstack/react-start" {
	interface Register {
		server: {
			requestContext: {
				fromFetch: boolean;
			};
		};
	}
}

export const startInstance = createStart(() => {
	return {
		defaultSsr: true,
		// Server functions are public HTTP endpoints. Registering the check here
		// rather than per-function makes authentication the default: a new server
		// function is protected without its author writing any auth code, and the
		// only opt-out is an entry in PUBLIC_SERVER_FNS.
		functionMiddleware: [protectedFunctionMiddleware],
	};
});

startInstance.createMiddleware().server(({ next }) => {
	return next({
		context: {
			fromStartInstanceMw: true,
		},
	});
});
