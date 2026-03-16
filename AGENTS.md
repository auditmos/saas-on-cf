# saas-on-cf

Monorepo: TanStack Start frontend + Hono API backend on Cloudflare Workers.

## Packages

| Package | Purpose |
|---------|---------|
| `packages/data-ops` | Shared DB layer (Drizzle, Zod, Better Auth) |
| `apps/data-service` | REST API (Hono on CF Workers) |
| `apps/user-application` | SSR Frontend (TanStack Start on CF Workers) |

Each has its own `AGENTS.md` with package-specific patterns (`CLAUDE.md` symlinks to `AGENTS.md`).

## Commands

```bash
pnpm run setup                    # install + build data-ops
pnpm run dev:user-application     # frontend dev (port 3000)
pnpm run dev:data-service         # API dev (port 8788)
pnpm run deploy:staging:user-application
pnpm run deploy:staging:data-service
pnpm run deploy:production:user-application
pnpm run deploy:production:data-service
pnpm run seed:dev / seed:staging / seed:production
pnpm run lint                     # check all (formatting + linting)
pnpm run lint:fix                 # auto-fix all
pnpm run test                     # run all tests
pnpm run test:watch               # watch mode
pnpm run test:coverage            # with coverage report
```

## Verification

Lint auto-runs via PostToolUse hook on Edit/Write (biome check --write).

After completing changes, run manually:
1. `pnpm run types` — type-check all packages (builds data-ops first)
2. `pnpm run test` — run all tests

- Max 500 lines per source file — split if exceeding
- Biome config: `biome.json` (root), plugins: `.biome-plugins/*.grit`

## Design Docs

- `/docs` is the single source of truth for business requirements
- Apply review notes/status updates directly in the corresponding design doc
- Never create separate md files for reviews/audits/analyses unless explicitly asked
- Flag implementation deviations inline in the doc
