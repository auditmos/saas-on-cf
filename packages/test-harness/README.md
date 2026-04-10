# @repo/test-harness

Dual-profile test DB factory for the monorepo.

## Profiles

| Profile | Backend | When |
|---------|---------|------|
| `local` (default) | PGLite in-memory | Day-to-day TDD, `pnpm test` |
| `managed` | Neon Postgres HTTP | CI (ephemeral branch per PR) |

Both apply the same drizzle migrations from `packages/data-ops`.

## Usage

```bash
pnpm test                                          # local PGLite
TEST_DB_PROFILE=managed TEST_DATABASE_URL="..." pnpm test  # Neon
```

In CI, the managed profile is wired automatically via `neondatabase/create-branch-action`.

## Local Neon testing

1. Neon Console → create branch from main
2. Copy pooled connection string
3. `export TEST_DATABASE_URL="postgresql://..."` → `TEST_DB_PROFILE=managed pnpm test`
4. Delete branch when done
