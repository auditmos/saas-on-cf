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
└── hono/
    ├── app.ts            # Hono app, middleware chain, routes
    ├── handlers/         # Route handlers (thin, delegate to services)
    ├── services/         # Business logic, calls data-ops queries
    ├── middleware/       # request-id, cors, auth, rate-limiter, error-handler
    └── utils/            # ApiError class, error helpers
```

This Worker serves HTTP and nothing else. Adding a cron, queue, Durable Object,
or Workflow means adding the binding or trigger to `wrangler.jsonc` in the same
change — `scripts/worker-surface.test.ts` fails on a handler nothing can fire.

## Patterns

See `hono.md` and `error-handling.md` rules for handler/service/query patterns and Result/AppError details.

## Endpoints

- `GET /health/live` - liveness (instant 200)
- `GET /health/ready` - readiness (checks DB)
- `GET|POST|PUT|DELETE /clients/*` - CRUD (all routes require a session cookie or the service Bearer token; the router guard is `use("*")`, so new routes are protected by default)

<important if="you are adding or modifying middleware in data-service">
## Middleware Order (in app.ts)

1. `requestId()` - generates/passes correlation ID
2. `createSecureHeadersMiddleware()` - response security headers
3. `onError` - global error handler
4. `createCorsMiddleware()` - CORS headers
5. `rateLimiter("data-service")` - metering, ahead of every route's session check
6. Route-specific: `requireSession`, `zValidator`
</important>

## Dev

```bash
pnpm run dev                # local dev server (port 8788)
pnpm run deploy:staging     # wrangler deploy --env staging
pnpm run deploy:production  # wrangler deploy --env production
```

## Env vars

Required in `.dev.vars` (local) or Cloudflare dashboard (remote):
- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `API_TOKEN` - Bearer token for protected endpoints
- `CLOUDFLARE_ENV` - dev | staging | production
- `ALLOWED_ORIGINS` - comma-separated origins (prod/staging only)

## Don't

- Put DB queries here - add to `@repo/data-ops/{domain}`
- Forget to rebuild data-ops before *running* against a schema change (`pnpm --filter @repo/data-ops build`) — type-checking already reads its source, tests and `wrangler dev` do not
- Modify `worker-configuration.d.ts`, use `pnpm run cf-typegen`
