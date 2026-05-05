# SaaS-on-CF (Software as a Service on Cloudflare)

*AI agent index: [llms.txt](./llms.txt)*

Modular web application template

## Using this Template

1. Click **Use this template** on GitHub (or `gh repo create --template`).
2. Rename the workers in `apps/user-application/wrangler.jsonc` and `apps/data-service/wrangler.jsonc` (`name` field), plus `apps/*/package.json` (`name`).
3. Provision a Neon database and fill in `packages/data-ops/.env.dev` (see [.env.example](./packages/data-ops/.env.example)), `apps/data-service/.dev.vars`, and `apps/user-application/.env`.
4. Run `pnpm run setup && pnpm run db:migrate:dev`.
5. Start dev in two terminals: `pnpm run dev:data-service` (port 8788) and `pnpm run dev:user-application` (port 3000).
6. Delete the example `client` domain (`packages/data-ops/src/client/`, `apps/data-service/src/hono/handlers/client-handlers.ts` + related service/routes, and its uses in `apps/user-application`) when you no longer need the demo, and start modelling your own domain.

See [Setup](#setup) and [Deployment](#deployment) below for the full dev/deploy loop.

## Architecture

Monorepo using [pnpm workspace](https://pnpm.io/workspaces):

- [apps/user-application](./apps/user-application/) - TanStack Start consumer-facing app
- [apps/data-service](./apps/data-service/) - Backend service for long-running tasks
- [packages/data-ops](./packages/data-ops/) - Shared DB layer (schemas, queries, auth)

Stack: [Better Auth](https://www.better-auth.com/docs/introduction), [Drizzle ORM](https://orm.drizzle.team/docs/overview), [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Neon Postgres](https://neon.tech).

## Setup

```bash
pnpm run setup
```

Installs all dependencies and builds data-ops package.

## Development

```bash
pnpm run dev:user-application  # TanStack Start app (port 3000)
pnpm run dev:data-service      # Hono backend service (port 8788)
```

### Database Migrations

From the repo root (proxies to `packages/data-ops`):

```bash
pnpm run db:generate:dev   # Generate migration
pnpm run db:migrate:dev    # Apply to database
pnpm run db:pull:dev       # Pull schema from DB
pnpm run db:seed:dev       # Seed sample data
pnpm run db:studio         # Open Drizzle Studio (dev only)
```

Replace `dev` with `staging` or `production` (except `db:studio`, which is dev-only).

### Environment Variables

- `packages/data-ops/` — `.env.dev`, `.env.staging`, `.env.production` (see [.env.example](./packages/data-ops/.env.example))
- `apps/user-application/` — `.env` files per Vite mode
- `apps/data-service/` — `.dev.vars` (local), Cloudflare dashboard (remote)

## Testing

```bash
pnpm run test              # run all tests
pnpm run test:watch        # watch mode
pnpm run test:coverage     # with coverage report
```

Uses [Vitest](https://vitest.dev) with workspace projects. Each package can also run tests independently via `pnpm --filter <package> test`.

## Deployment

```bash
pnpm run deploy:staging:user-application
pnpm run deploy:staging:data-service
pnpm run deploy:production:user-application
pnpm run deploy:production:data-service
```

Secrets sync: `bash apps/{app}/sync-secrets.sh {env}`

### Cloudflare Account Override

To deploy to a different CF account, copy `.env.example` to `.env` and fill in `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`.

## Package Docs

Each package has its own `AGENTS.md` with detailed structure, patterns, and workflows (`CLAUDE.md` symlinks to `AGENTS.md`).

## Brainstormer

Planning skills ([brainstormer](https://github.com/auditmos/brainstormer)) are pre-configured via `extraKnownMarketplaces` and `enabledPlugins` in `.claude/settings.json`. They install automatically on first open.

To update to the latest brainstormer skills:

```bash
/plugin marketplace update brainstormer
```
