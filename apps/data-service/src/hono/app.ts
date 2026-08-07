import { Hono } from "hono";
import clients from "./handlers/client-handlers";
import health from "./handlers/health-handlers";
import { createCorsMiddleware } from "./middleware/cors";
import { onErrorHandler } from "./middleware/error-handler";
import { rateLimiter } from "./middleware/rate-limiter";
import { requestId } from "./middleware/request-id";
import { createSecureHeadersMiddleware } from "./middleware/secure-headers";

export const App = new Hono<{ Bindings: Env }>();

App.use("*", requestId());
App.use("*", createSecureHeadersMiddleware());
App.onError(onErrorHandler);
App.use("*", createCorsMiddleware());
// Ahead of every route, and ahead of the session check inside them: metering an
// unauthenticated flood should not cost a session lookup per request. Which
// routes this actually touches is the policy module's decision, not this file's.
App.use("*", rateLimiter("data-service"));

App.route("/health", health);
App.route("/clients", clients);
