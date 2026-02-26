# Change 1: data-ops domain barrels

Status: **DONE**

Dependencies: none (all other changes depend on this)

## Target structure

```
src/
├── client/
│   ├── table.ts        ← from drizzle/schema.ts
│   ├── schema.ts       ← from zod-schema/client.ts
│   ├── queries.ts      ← from queries/client.ts (update internal imports)
│   └── index.ts        ← barrel
├── health/
│   ├── schema.ts       ← from zod-schema/health.ts
│   ├── queries.ts      ← from queries/health.ts (update internal imports)
│   └── index.ts        ← barrel
├── drizzle/
│   ├── auth-schema.ts  # stays (auto-generated)
│   └── relations.ts    # stays (cross-domain)
├── database/setup.ts   # stays (infra)
└── auth/               # stays (infra)
```

## package.json exports

Replace layer-based globs with domain entry points:

```json
"exports": {
  "./client": { "types": "./dist/client/index.d.ts", "default": "./dist/client/index.js" },
  "./health": { "types": "./dist/health/index.d.ts", "default": "./dist/health/index.js" },
  "./auth/*": { "types": "./dist/auth/*.d.ts", "default": "./dist/auth/*.js" },
  "./database/*": { "types": "./dist/database/*.d.ts", "default": "./dist/database/*.js" },
  "./drizzle/*": { "types": "./dist/drizzle/*.d.ts", "default": "./dist/drizzle/*.js" }
}
```

Remove: `./queries/*`, `./zod-schema/*`, `./mocks/*`

## Internal import updates

- `client/queries.ts`: `../database/setup` -> `@/database/setup`, `../drizzle/schema` -> `./table`, `../zod-schema/client` -> `./schema`
- `health/queries.ts`: `../database/setup` -> `@/database/setup`, `../zod-schema/health` -> `./schema`
- `database/seed/seed.ts`: `../../drizzle/schema` -> `../../client/table`
- `drizzle-{dev,staging,production}.config.ts`: schema array `./src/drizzle/schema.ts` -> `./src/client/table.ts`

## Consumer import updates (all collapse to single path)

**data-service** (4 files):
- `src/hono/services/client-service.ts` -- `@repo/data-ops/queries/client` + `@repo/data-ops/zod-schema/client` -> `@repo/data-ops/client`
- `src/hono/services/health-service.ts` -- `@repo/data-ops/queries/health` + `@repo/data-ops/zod-schema/health` -> `@repo/data-ops/health`
- `src/hono/handlers/client-handlers.ts` -- `@repo/data-ops/zod-schema/client` -> `@repo/data-ops/client`
- `src/hono/handlers/health-handlers.ts` -- `@repo/data-ops/zod-schema/health` -> `@repo/data-ops/health`

**user-application** (5+ files):
- `core/functions/clients/direct.ts` -- two imports -> one
- `core/functions/clients/binding.ts` -- `@repo/data-ops/zod-schema/client` -> `@repo/data-ops/client`
- `core/functions/clients/types.ts` -- `@repo/data-ops/zod-schema/client` -> `@repo/data-ops/client`
- `lib/api-client.ts` -- `@repo/data-ops/zod-schema/client` -> `@repo/data-ops/client`
- route files importing `type { Client }` from `@repo/data-ops/zod-schema/client` (update, etc.)

## Delete

- `src/queries/` directory (both files moved)
- `src/zod-schema/` directory (both files moved)
- `src/drizzle/schema.ts` (moved to `client/table.ts`)

## Rule updates

### `.claude/rules/data-ops/drizzle.md`

- "Define tables in `drizzle/schema.ts`" -> "Define tables in `{domain}/table.ts`"
- "Place reusable queries in `queries/*.ts`" -> "Place queries in `{domain}/queries.ts`"

### `packages/data-ops/CLAUDE.md`

Reflect new domain-based structure.

## Resolved decisions

1. **relations.ts** -- when it needs `clients` table, import `../client/table` directly (cross-domain import is fine for relations)

## Verification

```bash
pnpm --filter @repo/data-ops build
pnpm run lint
pnpm run lint:fix
```
