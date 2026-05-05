import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

// biome-ignore-start lint/suspicious/noExplicitAny: shared shape across PGlite + Neon adapters; their concrete generics diverge
export type TestDb = PgDatabase<any, any, any>;
// biome-ignore-end lint/suspicious/noExplicitAny: shared shape across PGlite + Neon adapters; their concrete generics diverge

export interface TestDbHandle {
	db: TestDb;
	cleanup: () => Promise<void>;
}

type Profile = "local" | "managed";

function resolveProfile(): Profile {
	const raw = process.env.TEST_DB_PROFILE ?? "local";
	if (raw === "local" || raw === "managed") return raw;
	throw new Error(`Unknown TEST_DB_PROFILE=${raw}. Expected "local" or "managed".`);
}

// ADAPT THIS PATH to your project's migration directory.
const MIGRATIONS_FOLDER = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../data-ops/src/drizzle/migrations/dev",
);

async function createLocalDb(): Promise<TestDbHandle> {
	const pg = new PGlite();
	const db = drizzlePglite(pg) as unknown as TestDb;
	await migratePglite(drizzlePglite(pg), { migrationsFolder: MIGRATIONS_FOLDER });

	let closed = false;
	return {
		db,
		cleanup: async () => {
			if (closed) return;
			closed = true;
			await pg.close();
		},
	};
}

async function createManagedDb(): Promise<TestDbHandle> {
	const url = process.env.TEST_DATABASE_URL;
	if (!url) {
		throw new Error(
			"TEST_DB_PROFILE=managed requires TEST_DATABASE_URL to be set to a Neon Postgres connection string.",
		);
	}

	const sqlClient = neon(url);
	const db = drizzleNeon(sqlClient) as unknown as TestDb;
	await migrateNeon(drizzleNeon(sqlClient), { migrationsFolder: MIGRATIONS_FOLDER });

	return { db, cleanup: async () => {} };
}

export async function createTestDb(): Promise<TestDbHandle> {
	const profile = resolveProfile();
	if (profile === "managed") return createManagedDb();
	return createLocalDb();
}
