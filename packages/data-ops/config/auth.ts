// packages/data-ops/config/auth.ts
import { createBetterAuth } from "../src/auth/setup";
import { initDatabase } from "../src/database/setup";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = createBetterAuth({
  database: drizzleAdapter(
    initDatabase({
      password: process.env.DATABASE_PASSWORD!,
      host: process.env.DATABASE_HOST!,
      username: process.env.DATABASE_USERNAME!,
    }),
    {
      provider: "mysql",
    },
  ),
});
