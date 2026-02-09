// DO NOT DELETE THIS FILE!!!
// This file is a good smoke test to make sure the custom server entry is working
import { setAuth } from "@repo/data-ops/auth/server";
import { getDb, initDatabase } from "@repo/data-ops/database/setup";
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

console.log("[server-entry]: using custom server entry in 'src/server.ts'");

export default {
  fetch(request: Request) {
    initDatabase({
      host: env.DATABASE_HOST,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
    });

    setAuth({
      secret: env.BETTER_AUTH_SECRET,
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
