# Change 2B: user-application AppError + thrown errors

Dependencies: 001-domain-barrels (import paths change)

## Create `src/core/errors.ts`

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public field?: string,
  ) {
    super(message)
    this.name = "AppError"
  }
}
```

## Modify `core/functions/clients/direct.ts`

Throw `AppError` instead of returning `MutationResult`:

```ts
// Before: return { success: false, error: "Email already exists", code: "EMAIL_EXISTS", field: "email" }
// After:  throw new AppError("Email already exists", "EMAIL_EXISTS", 409, "email")

// Return type: Promise<Client> instead of Promise<MutationResult>
```

## Modify `core/functions/clients/binding.ts`

Same -- throw `AppError` on `!response.ok`.

## Modify `lib/api-client.ts`

Replace `ApiError` class with import of `AppError` from `@/core/errors`. Adjust constructor arg order (`ApiError(msg, status, code)` -> `AppError(msg, code, status)`).

## Delete `core/functions/clients/types.ts`

`MutationResult`, `MutationError`, `DeleteResult` no longer needed.

## Update route files (9 mutation routes)

Pattern change in all create/update/delete routes across direct, binding, api:

```tsx
// Before (discriminated union):
onSuccess: (result) => { if (result.success) { ... } }
{mutation.isSuccess && mutation.data.success && <Alert>...</Alert>}
{mutation.isSuccess && !mutation.data.success && <Alert>{mutation.data.error}</Alert>}

// After (thrown errors):
onSuccess: () => { queryClient.invalidateQueries(...) }
{mutation.isSuccess && <Alert variant="success">...</Alert>}
{mutation.isError && <Alert variant="destructive">{mutation.error.message}</Alert>}
```

Files:
- `routes/_auth/dashboard/direct/{create,update,delete}.tsx`
- `routes/_auth/dashboard/binding/{create,update,delete}.tsx`
- `routes/_auth/dashboard/api/{create,update,delete}.tsx` -- already throw, just replace `ApiError` -> `AppError` checks

## Resolved decisions

1. **unique violation check** -- fix now. Replace `error.message.includes("unique")` with `error.cause.code === '23505'` per drizzle.md rule. Applies to user-application direct.ts.

## Update `apps/user-application/CLAUDE.md`

Document AppError pattern.

## Verification

```bash
pnpm run lint
pnpm run lint:fix
pnpm run dev:user-application # smoke test all 15 dashboard pages
```
