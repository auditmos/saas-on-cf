# Error Handling (Cross-Package)

## Layered Approach

| Layer | Pattern | Location |
|-------|---------|----------|
| DB | Drizzle wraps pg errors in `DrizzleQueryError` | data-ops |
| API services | Return `Result<T>` | data-service `types/result.ts` |
| Frontend | Throw `AppError` from server fns + API client | user-application `core/errors.ts` |

## Drizzle Error Unwrapping

`error.cause` holds original Postgres error, NOT `error.message`.
`error.message` = `"Failed query: <SQL>\nparams: <values>"` — never contains constraint info.
Check `error.cause.code` for pg codes (e.g. `23505` = unique violation).

```ts
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = error.cause
  if (cause instanceof Error) {
    const pgCode = (cause as Error & { code?: string }).code
    if (pgCode === '23505') return true
  }
  return false
}
```

## Result Pattern (data-service)

Services return `Result<T>` — never throw `HTTPException`.
`AppError` shape: `code`, `message`, `status`, optional `field`.
Handlers unwrap via `resultToResponse`. Unexpected errors propagate to global `onError`.

## AppError (user-application)

`AppError` in `core/errors.ts`. Constructor: `new AppError(message, code, status?, field?)`.
Server functions (direct/binding) throw `AppError`.
`api-client.ts` throws `AppError` on `!response.ok`.
Route components use `mutation.isError` / `mutation.error.message`.
