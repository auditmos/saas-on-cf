# SaaS-on-CF (Software as a Service on Cloudflare) - Data Service

Modular web application template - data service (backend package)

## Architecture

Backend service for long-running tasks and API endpoints also place to utilize Cloudflare primitives.

- **`wrangler.jsonc`** - Definitions for Cloudflare primitives.

### Directory Structure

#### [`src/durable-objects/`](./src/durable-objects/)
Cloudflare Durable Objects.

- **`example-durable-object.ts`** - Sample definition for DO

#### [`src/hono/`](./src/hono/)
Hono Framework.

##### [`src/hono/handlers/`](./src/hono/handlers)

##### [`src/hono/middleware/`](./src/hono/middleware)

##### [`src/hono/services/`](./src/hono/services)

##### [`src/hono/utils/`](./src/hono/utils)

- **`app.ts`** - Main entrypoint

#### [`src/queues/`](./src/queues/)
Cloudflare Queues.

- **`index.ts`** - Sample queue

#### [`src/scheduled/`](./src/scheduled/)
Cloudflare Scheduled (Cron).

- **`index.ts`** - Sample scheduler

#### [`src/workflows/`](./src/workflows/)
Cloudflare Workflows.

- **`example-workflow.ts`** - Sample definition for Workflow

### Environment Variables

Config files in `apps/data-service/`:
- `.dev.vars` - Local development
- `.staging.vars` - Staging
- `.production.vars` - Production

Sample `.example.vars` file with minimum number of values available - [.example.vars](./apps/data-service/.example.vars)

### Helpers script

Sync script - synchronize secrets with remote environment

```bash
chmod +x sync-secrets.sh
./sync-secrets.sh {env}
```