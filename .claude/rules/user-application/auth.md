---
paths:
  - "apps/user-application/**/*.{ts,tsx}"
---

# Client Auth Rules (Better Auth)

## Auth Client Setup

```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: '/api/auth',
})

export const { useSession, signIn, signOut } = authClient
```

## Session Hook

```tsx
function UserMenu() {
  const { data: session, isPending } = useSession()

  if (isPending) return <Spinner />
  if (!session) return <SignInButton />

  return (
    <div>
      {session.user.name}
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

## Protected Routes

Use TanStack Router middleware:

```ts
// core/middleware/auth.ts
import { createMiddleware } from '@tanstack/react-start'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getSession()
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return next({ context: { session } })
})
```

Apply to routes:

```tsx
// routes/_auth/dashboard.tsx
export const Route = createFileRoute('/_auth/dashboard')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
})
```

## Auth Forms

Uses standard `form-patterns.md` template. Auth-specific notes:

- `mutationFn` wraps `authClient.signIn.email(data)` — check `result.error` and throw
- Use `mutateAsync` + `navigate({ to: "/dashboard" })` in `onSubmit`
- No `onSuccess` on mutation — navigation happens in form's `onSubmit`

## Security Patterns

- Never expose tokens in client code
- Use HTTP-only cookies (Better Auth default)
- Validate session on sensitive operations
- Redirect to login on 401 responses

```ts
// API client interceptor
if (response.status === 401) {
  window.location.href = '/login'
}
```

## Server Functions with Auth

```ts
export const getSecureData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context.session guaranteed to exist
    return fetchDataForUser(context.session.user.id)
  })
```
