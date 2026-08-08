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
pnpm run db:seed:dev / db:seed:staging / db:seed:production
pnpm run lint                     # check all (formatting + linting)
pnpm run lint:fix                 # auto-fix all
pnpm run test                     # run all tests
pnpm run test:watch               # watch mode
pnpm run test:coverage            # with coverage report
```

## Verification

Lint auto-runs via PostToolUse hook on Edit/Write (biome check --write).
Max 500 lines per source file — split if exceeding.

<important if="you have finished implementing or modifying code">
Run manually before declaring done:
1. `pnpm run types` — type-check all packages (no build needed; consumers read data-ops source)
2. `pnpm run test` — run all tests
</important>

## Documentation

These files are read as instructions, not as background. Anything they describe
has to exist — `scripts/doc-truth.test.ts` fails when one names a path that does
not resolve. Document what was built, not what is planned; a specification for
unbuilt software reads to the next agent as something to extend.

Never create separate md files for reviews/audits/analyses unless explicitly asked.
