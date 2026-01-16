import { Hono } from "hono";
import health from "./handlers/health-handlers";
import users from "./handlers/user-handlers";
import { errorHandler, onErrorHandler } from "./middleware/error-handler";

export const App = new Hono<{ Bindings: Env }>();

App.onError(onErrorHandler);

App.use('*', errorHandler());

App.route('/health', health);
App.route('/users', users);  