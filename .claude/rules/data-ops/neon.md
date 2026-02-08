---
paths:
  - "packages/data-ops/**/*.ts"
---

# Neon Database Rules

## Connection Setup

- Singleton pattern: `initDatabase()` once in Worker entry, `getDb()` everywhere else
- Connection string built internally from host/username/password
- Uses `drizzle-orm/neon-http` adapter (Neon HTTP driver implicit)

```ts
// packages/data-ops/src/database/setup.ts
import { drizzle } from 'drizzle-orm/neon-http'

let db: ReturnType<typeof drizzle>

export function initDatabase(connection: {
  host: string
  username: string
  password: string
}) {
  if (db) return db
  const connectionString = `postgres://${connection.username}:${connection.password}@${connection.host}`
  db = drizzle(connectionString)
  return db
}

export function getDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}
```

## Initialization

- Call `initDatabase()` in Worker constructor/entry point
- DB env vars set via `.env.*` file on **user-application** and `.*.vars` file on **data-service** (sync with `sync-secrets.sh`), not wrangler.jsonc

```ts
// Worker entry (data-service or user-application)
initDatabase({
  host: env.DATABASE_HOST,
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
})
```

## Environment Variables

```bash
DATABASE_HOST="ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
DATABASE_USERNAME="neondb_owner"
DATABASE_PASSWORD="npg_xxx"
```

- HOST includes DB name, SSL params, and pooler config
- Separate values per environment (dev/staging/production)

## Query Layer

- All queries call `getDb()` — never accept DB as parameter
- Use Drizzle query builder (`select`, `insert`, `update`, `delete`)
- Use `.returning()` for mutations

```ts
import { getDb } from '../database/setup'
import { users } from '../drizzle/schema'

export async function getUser(userId: string) {
  const db = getDb()
  const result = await db.select().from(users).where(eq(users.id, userId))
  return result[0] ?? null
}
```

## Migrations

- Drizzle Kit with env-specific configs: `drizzle-{env}.config.ts`
- Separate migration output dirs per env: `migrations/dev`, `migrations/staging`, `migrations/production`
- Schema sources: `auth-schema.ts`, `schema.ts`, `relations.ts`

## Serverless Patterns

- Neon pooler endpoint in HOST — no manual pool config
- Singleton `db` cached per Worker isolate lifetime
- Stateless per-request query execution at edge

## Best Practices

- Avoid long-running transactions in serverless
- Use `Promise.all()` for independent parallel queries
- Use `.returning()` on insert/update/delete to avoid extra round trips
- Use `.onConflictDoNothing()` for idempotent inserts (seeds)
