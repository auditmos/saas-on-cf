# Change 2A: data-service Result pattern

Dependencies: 001-domain-barrels (import paths change)

## Create `src/hono/types/result.ts`

```ts
interface AppError {
  code: string
  message: string
  status: number
  field?: string
}

type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E }
```

## Modify `src/hono/services/client-service.ts`

Services return `Result<T>` instead of throwing `HTTPException`:

```ts
export async function getClientById(id: string): Promise<Result<Client>> {
  const client = await getClient(id)
  if (!client) return { ok: false, error: { code: "NOT_FOUND", message: "Client not found", status: 404 } }
  return { ok: true, data: client }
}
```

Same for `createClient`, `updateClient`, `deleteClient`, `getClients`. Remove `HTTPException` import.

## Modify `src/hono/handlers/client-handlers.ts`

Unwrap Result in handlers. Add helper:

```ts
function resultToResponse<T>(c: Context, result: Result<T>, successStatus: ContentfulStatusCode = 200) {
  if (!result.ok) return c.json({ error: result.error.message, code: result.error.code }, result.error.status as ContentfulStatusCode)
  return c.json(result.data, successStatus)
}
```

## What to keep

### Keep `HTTPException` in error-handler.ts

**Critical:** `@hono/zod-validator` throws `HTTPException` on validation failure. The global error handler MUST keep catching `HTTPException` as safety net. Only services stop throwing it.

### Keep `utils/error-handling.ts`

`ApiError` class stays as safety net for unexpected throws. No changes needed.

## Resolved decisions

1. **unique violation check** -- fix now. Replace `error.message.includes("unique")` with `error.cause.code === '23505'` per drizzle.md rule. Applies to data-service services.

## Update `apps/data-service/CLAUDE.md`

Document Result pattern in services.

## Verification

```bash
pnpm run lint
pnpm run lint:fix
pnpm run dev:data-service    # smoke test endpoints
```
