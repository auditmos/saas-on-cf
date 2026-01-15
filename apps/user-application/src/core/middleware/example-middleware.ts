import { createMiddleware } from "@tanstack/react-start";

export const exampleMiddlewareWithContext = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  console.log("Executing exampleMiddlewareWithContext");
  return await next({
    context: {
      data: "Some Data From Middleware",
    },
  });
});
