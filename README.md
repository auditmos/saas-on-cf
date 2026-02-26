# SaaS-on-CF (Software as a Service on Cloudflare)

Modular web application template

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

From `packages/data-ops/` directory:

```bash
pnpm run drizzle:dev:generate  # Generate migration
pnpm run drizzle:dev:migrate   # Apply to database
```

Replace `dev` with `staging` or `production`.

### Environment Variables

- `packages/data-ops/` — `.env.dev`, `.env.staging`, `.env.production` (see [.env.example](./packages/data-ops/.env.example))
- `apps/user-application/` — `.env` files per Vite mode
- `apps/data-service/` — `.dev.vars` (local), Cloudflare dashboard (remote)

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

Each package has its own `CLAUDE.md` with detailed structure, patterns, and workflows.
