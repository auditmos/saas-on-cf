import { createMiddleware } from "@tanstack/react-start";

export const exampleMiddlewareWithContext = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	return await next({
		context: {
			data: "Some Data From Middleware",
		},
	});
});
