# SaaS-on-CF (Software as a Service on Cloudflare)

*AI agent index: [llms.txt](./llms.txt)*

Modular web application template

## Using this Template

1. Click **Use this template** on GitHub (or `gh repo create --template`).
2. `pnpm install`.
3. `pnpm run init-project` — prompts for a kebab-case project name, renames every `wrangler.jsonc` + root `package.json`, and fans out the `*.example` templates into per-env files (`apps/data-service/.{dev,staging,production}.vars`, `apps/user-application/.env{,.staging,.production}`, `packages/data-ops/.env.{dev,staging,production}`). Idempotent — re-runnable, never overwrites filled-in files. The script's "Next steps" output lists every field that still needs a value.
4. Provision a Neon database and fill `DATABASE_HOST/USERNAME/PASSWORD` in the env files created above. Set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) in `apps/user-application/.env*` and the matching `VITE_API_TOKEN` / `DATA_SERVICE_API_TOKEN` / `API_TOKEN` triple per environment.
5. Run `pnpm run setup && pnpm run db:generate:dev && pnpm run db:migrate:dev`.
6. Start dev in two terminals: `pnpm run dev:data-service` (port 8788) and `pnpm run dev:user-application` (port 3000).
7. *(Optional, when you're done with the demo)* delete the example `client` domain: `packages/data-ops/src/client/`, `apps/data-service/src/hono/handlers/client-handlers.ts` + matching service/routes, and its uses in `apps/user-application`. Then start modelling your own domain.

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
