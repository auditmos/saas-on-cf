# data-service

Cloudflare Worker API exposing data-ops queries via Hono REST endpoints.

## Stack

- Hono (Cloudflare Workers adapter)
- WorkerEntrypoint class pattern
- Consumes `@repo/data-ops` for DB queries and Zod schemas

## Structure

```
src/
├── index.ts              # Worker entrypoint, initializes DB
├── hono/
│   ├── app.ts            # Hono app, middleware chain, routes
│   ├── handlers/         # Route handlers (thin, delegate to services)
│   ├── services/         # Business logic, calls data-ops queries
│   ├── middleware/       # request-id, cors, auth, rate-limiter, error-handler
│   └── utils/            # ApiError class, error helpers
├── scheduled/            # Cron triggers
├── queues/               # Queue consumers
├── durable-objects/      # Durable Objects
└── workflows/            # Workflows
```

## Patterns

**Handlers → Services → data-ops queries**
- Handlers: validation, auth middleware, unwrap `Result<T>` via `resultToResponse`, return response
- Services: return `Result<T>` (no `HTTPException`), call data-ops queries
- Queries: imported from `@repo/data-ops/{domain}`

**Result pattern** (services):
- Services return `Result<T>` from `types/result.ts` instead of throwing
- `AppError` has `code`, `message`, `status`, optional `field`
- Unexpected errors still throw (caught by global error handler)
- Error unwrapping details: see `error-handling.md` rule

**Middleware order** (in app.ts):
1. `requestId()` - generates/passes correlation ID
2. `onError` - global error handler
3. `cors` - CORS headers
4. Route-specific: `authMiddleware`, `rateLimiter`, `zValidator`

**Zod validation**: use `zValidator('param' | 'query' | 'json', Schema)`

**Error handling**: services return `Result<T>`; `HTTPException` still caught by `onErrorHandler` (for `@hono/zod-validator` + safety net)

## Endpoints

- `GET /health/live` - liveness (instant 200)
- `GET /health/ready` - readiness (checks DB)
- `GET|POST|PUT|DELETE /users/*` - CRUD (POST/PUT/DELETE require Bearer token)
- `POST /webhooks/*` - inbound webhooks (signature verified)

## Webhooks

**Pattern:** verification middleware → handler → service → data-ops

**Key constraint:** signature verification needs raw body string before JSON parsing. Cannot use `zValidator` as route middleware. Instead:
1. Middleware reads body via `c.req.text()`, stores in context
2. Verifies signature against raw string
3. Handler parses body with `Schema.parse(JSON.parse(body))`

**Headers (standard-webhooks):**
- `webhook-id` - UUID, used for idempotency
- `webhook-timestamp` - unix seconds, 5min tolerance
- `webhook-signature` - `v1,<base64 HMAC-SHA256>`

**Idempotency:** `webhook_logs.msgId` unique constraint - duplicates are no-ops

## Dev

```bash
pnpm run dev              # local dev server
pnpm run deploy:dev       # deploy to dev
pnpm run deploy:staging   # deploy to staging
pnpm run deploy:prod      # deploy to production
```

## Env vars

Required in `.dev.vars` (local) or Cloudflare dashboard (remote):
- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `API_TOKEN` - Bearer token for protected endpoints
- `CLOUDFLARE_ENV` - dev | staging | production
- `ALLOWED_ORIGINS` - comma-separated origins (prod/staging only)

## Don't

- Put DB queries here - add to `@repo/data-ops/{domain}`
- Forget to rebuild data-ops after schema changes (`pnpm --filter @repo/data-ops build`)
- Modify `worker-configuration.d.ts`, use `pnpm run cf-typegen`
