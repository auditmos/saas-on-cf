# SaaS-on-CF (Software as a Service on Cloudflare)

Modular web application template

## Architecture

Monorepo using [pnpm workspace](https://pnpm.io/workspaces) with modular packages shared across apps:

- [apps/user-application](./apps/user-application/) - TanStack Start consumer-facing app
- [apps/data-service](./apps/data-service/) - Backend service for long-running tasks
- [packages/data-ops](./packages/data-ops/) - Shared DB layer (schemas, queries, auth)

Stack: 

- [Better Auth](https://www.better-auth.com/docs/introduction), 
- [Drizzle ORM](https://orm.drizzle.team/docs/overview), 
- [Cloudflare Workers](https://developers.cloudflare.com/workers/), 
- [Neon Postgres](https://neon.tech).

## [packages/data-ops](./packages/data-ops/)

Central shared package for all database operations. Both apps consume this package for type-safe DB access.

**Purpose**: Single source of truth for database schemas, queries, validations, and auth config.

### Directory Structure

#### [`src/drizzle/`](./packages/data-ops/src/drizzle/)
Core database definitions using Drizzle ORM.

- **`schema.ts`** - Main application tables
- **`auth-schema.ts`** - Better Auth tables (auto-generated, don't edit manually)
- **`relations.ts`** - Drizzle relational queries config (defines joins between tables)
- **`migrations/{env}/`** - Migration history per environment (dev/staging/production)

#### [`src/queries/`](./packages/data-ops/src/queries/)
Reusable database operations exported as functions.

Example: `user.ts` exports `getUser()`

**Usage**: Import and call from apps - handles DB connection internally via `getDb()`.

```ts
import { getUser } from "data-ops/queries/user";
const user = await getUser(userId);
```

#### [`src/zod-schema/`](./packages/data-ops/src/zod-schema/)
Validation schemas using Zod.
- API request/response
- Forms
- DTOs

**Naming conventions:**

| Purpose      | Suffix         | Example                 |
|--------------|----------------|-------------------------|
| Domain model | Schema         | UserSchema              |
| Request      | RequestSchema  | UserCreateRequestSchema |
| Response     | ResponseSchema | UserListResponseSchema  |
| Type         | no suffix      | User, UserCreateInput   |

**Purpose**: Type-safe contracts between frontend/backend. Validates data shape at runtime.

Example: `user.ts` exports `UserSchema` schema.

#### [`src/database/`](./packages/data-ops/src/database/)
- **`setup.ts`** - DB client initialization (`getDb()` function)
- **`seed/`** - Data seeding utilities

#### [`src/auth/`](./packages/data-ops/src/auth/)
Better Auth configuration.
- **`setup.ts`** - Auth config (providers, plugins)
- **`server.ts`** - Auth server instance

### Workflow for New DB Features

1. **Add table** to `src/drizzle/schema.ts`
2. **Add relations** to `src/drizzle/relations.ts` (if needed)
3. **Generate migration**: `pnpm run drizzle:dev:generate`
4. **Apply migration**: `pnpm run drizzle:dev:migrate`
5. **Create queries** in `src/queries/{feature}.ts`
6. **Create Zod schemas** in `src/zod-schema/{feature}.ts`
7. **Rebuild package**: `pnpm run build:data-ops`
8. **Import in apps**: Use queries/schemas from both apps:
- [user-application](./apps/user-application/)
- [data-service](./apps/data-service/)

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

Replace `dev` with `staging` or `production`. Migrations stored in `src/drizzle/migrations/{env}/`.

### Environment Variables

Config files in `packages/data-ops/`:
- `.env.dev` - Local development
- `.env.staging` - Staging
- `.env.production` - Production

Replace dev` with `staging` or `production`. 

Migrations stored in `src/drizzle/migrations/{env}/`.

Sample `.env` file with minimum number of values available - [.env.example](./packages/data-ops/.env.example)

## Deployment

### Cloudflare Account Configuration

If you want to deploy to a different Cloudflare account that is not logged in globally on your machine, prepare a `.env` file in the main directory with values from `.env.example`. This allows you to specify account credentials for deployment without changing your global Cloudflare configuration.

### User Application

Once the deployment is done, Cloudflare will response with URL to view the deployment. If you want to change the name associated with Worker, do so by changing the `name` in the [wrangler.jsonc](./apps/user-application/wrangler.jsonc) file.

You can also use your own domain names associated with Cloudflare account by adding a route to this file as well.

#### Staging Environment

```bash
pnpm run deploy:staging:user-application
```

This will deploy the [user-application](./apps/user-application/) to Cloudflare Workers into staging environment.

#### Production Environment

```bash
pnpm run deploy:production:user-application
```

This will deploy the [user-application](./apps/user-application/) to Cloudflare Workers into production environment.

### Data Service

Once the deployment is done, Cloudflare will response with URL to view the deployment. If you want to change the name associated with Worker, do so by changing the `name` in the [wrangler.jsonc](./apps/data-service/wrangler.jsonc) file.

You can also use your own domain names associated with Cloudflare account by adding a route to this file as well.

#### Staging Environment

```bash
pnpm run deploy:staging:data-service
```

This will deploy the [data-service](./apps/data-service/) to Cloudflare Workers into staging environment.

#### Production Environment

```bash
pnpm run deploy:production:data-service
```

This will deploy the [data-service](./apps/data-service/) to Cloudflare Workers into production environment.