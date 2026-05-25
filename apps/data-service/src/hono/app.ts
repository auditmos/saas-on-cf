import { Hono } from "hono";
import clients from "./handlers/client-handlers";
import health from "./handlers/health-handlers";
import { createCorsMiddleware } from "./middleware/cors";
import { onErrorHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { createSecureHeadersMiddleware } from "./middleware/secure-headers";

export const App = new Hono<{ Bindings: Env }>();

App.use("*", requestId());
App.use("*", createSecureHeadersMiddleware());
App.onError(onErrorHandler);
App.use("*", createCorsMiddleware());

App.route("/health", health);
App.route("/clients", clients);
