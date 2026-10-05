---
paths:
  - "apps/data-service/**/*.ts"
---

# Hono Framework Rules

## App Setup

- Type bindings via `Hono<{ Bindings: Env }>`
- Access env via `c.env`, not `process.env`
- Export `app.fetch` for Workers

```ts
import { Hono } from 'hono'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

export default {
  fetch: app.fetch,
}
```

## Middleware Chain

The order is fixed in `src/hono/app.ts` and listed in this app's `AGENTS.md`: requestId → secure headers → onError → cors → rateLimiter, then route-level session check and `zValidator`. The rate limiter runs before the session check so an unauthenticated flood does not cost a session lookup per request.

## Route Structure

- Handlers: thin wrappers, call services
- Services: business logic, call data-ops queries
- Keep handlers focused on HTTP concerns

```ts
// hono/handlers/client-handlers.ts
clients.get('/:id', zValidator('param', IdParamSchema), async (c) => {
  const { id } = c.req.valid('param')
  return resultToResponse(c, await clientService.getClientById(id))
})
```

## Request Validation

Validate requests with `zValidator` from `@hono/zod-validator`, not raw `z.parse()`, `z.safeParse()`, or manual `c.req.json()` parsing in handlers, so every handler reads typed input from `c.req.valid()` and invalid input fails the same way everywhere.

Pass `zValidator()` a named schema imported from `@repo/data-ops/{domain}`, not an inline `z.object()`, because data-ops is where the frontend reads the same schemas. If the schema doesn't exist yet, add it to data-ops first.

```ts
// CORRECT — named schema from data-ops
import { zValidator } from '@hono/zod-validator'
import { UserCreateSchema, UserIdParamSchema } from '@repo/data-ops/user'

app.post('/users',
  zValidator('json', UserCreateSchema),
  async (c) => {
    const data = c.req.valid('json') // typed!
  }
)

app.get('/users/:id',
  zValidator('param', UserIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
  }
)

// WRONG — inline z.object()
zValidator('param', z.object({ id: z.string().uuid() }))

// WRONG — raw Zod parsing
const body = await c.req.json()
const data = UserCreateSchema.parse(body)
```

## Error Handling

- Use custom `ApiError` class
- Centralize via error middleware
- Return consistent error shapes

```ts
class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

// In middleware
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.message }, err.statusCode)
  }
  console.error(err)
  return c.json({ error: 'Internal error' }, 500)
})
```

## Response Patterns

```ts
// Success
return c.json({ data: user })
return c.json({ data: users, meta: { total, page } })

// Error
return c.json({ error: 'Not found' }, 404)
return c.json({ error: 'Validation failed', details: errors }, 400)
```
