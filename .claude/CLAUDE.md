# saas-on-cf

Monorepo: TanStack Start frontend + Hono API backend on Cloudflare Workers.

## Packages

| Package | Purpose |
|---------|---------|
| `packages/data-ops` | Shared DB layer (Drizzle, Zod, Better Auth) |
| `apps/data-service` | REST API (Hono on CF Workers) |
| `apps/user-application` | SSR Frontend (TanStack Start on CF Workers) |

## Commands

```bash
pnpm run setup                    # install + build data-ops
pnpm run dev:user-application     # frontend dev (port 3000)
pnpm run dev:data-service         # API dev (port 8788)

# Deploy
pnpm run deploy:staging:user-application
pnpm run deploy:staging:data-service
pnpm run deploy:production:user-application
pnpm run deploy:production:data-service

# Data
pnpm run seed:dev
pnpm run seed:staging
pnpm run seed:production
```

## Rules Structure

Rules auto-load from `.claude/rules/`:

```
.claude/rules/
├── general.md              # Universal TypeScript
├── data-ops/               # DB/validation layer
│   ├── drizzle.md
│   ├── zod.md
│   ├── neon.md
│   └── better-auth.md
├── data-service/           # Backend API
│   ├── hono.md
│   ├── agent-sdk.md
│   ├── cloudflare-workers.md
│   ├── queues-workflows.md
│   ├── durable-objects.md
│   └── storage.md
└── user-application/       # Frontend
    ├── tanstack.md
    ├── react.md
    ├── ui.md
    └── auth.md
```

Rules with `paths:` frontmatter apply only when working with matching files.

## Design Docs

- `/docs` is the single source of truth for business requirements
- When reviewing, auditing, or analyzing a feature—apply all changes (notes, status updates, findings) directly in the corresponding design doc
- Never create separate md files for reviews/audits/analyses unless explicitly asked
- Implementation must align with the spec in `/docs`; flag deviations inline in the doc

## Key Patterns

- **No `any` type** - create explicit interfaces
- **Handlers → Services → Queries** - separation of concerns
- **Server functions for SSR** - `createServerFn()` in user-application
- **Zod validation everywhere** - API, forms, DB operations

## Package-Specific Docs

Each package has its own `CLAUDE.md`:
- @packages/data-ops/CLAUDE.md
- @apps/data-service/CLAUDE.md
- @apps/user-application/CLAUDE.md
