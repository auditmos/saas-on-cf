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

Server functions are protected by default: `protectedFunctionMiddleware` in
`core/middleware/auth.ts` is registered as global `functionMiddleware` in `start.tsx`.
It throws `AppError` (`UNAUTHENTICATED` / `NOT_APPROVED`) instead of redirecting, and
only functions listed in `core/public-server-fns.ts` run without a session.

Pages are protected by the layout route, so everything nested under it is covered —
including routes added later:

```tsx
// routes/_auth/route.tsx
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const auth = await getAuthView()
    if (auth.view === 'signed-out') {
      throw redirect({ to: '/signin' })
    }
    if (auth.view === 'pending-approval' && location.pathname.replace(/\/$/, '') !== '/dashboard') {
      throw redirect({ to: '/dashboard' })
    }
    return { auth }
  },
})
```

An unapproved account only ever sees `/dashboard`, where the layout renders the
pending-approval screen. Child loaders run before the layout renders, and their
server functions reject such an account (`NOT_APPROVED`), so on any page that
loads data it would get a 500. Keep `/dashboard` free of loaders;
`auth-route-guard.test.ts` checks it.

Read the session with `getSession({ headers: getRequest().headers })`, never
`getSession(getRequest())`. Better Auth copies its argument, a `Request` keeps
its headers on the prototype, and the copy fails with "Headers is required".

## Auth Forms

Uses standard `form-patterns.md` template. Auth-specific notes:

- `mutationFn` wraps `authClient.signIn.email(data)` — check `result.error` and throw
- Use `mutateAsync` + `navigate({ to: "/dashboard" })` in `onSubmit`
- No `onSuccess` on mutation — navigation happens in form's `onSubmit`

## Security Patterns

- Never expose tokens in client code
- Use HTTP-only cookies (Better Auth default)
- Validate session on sensitive operations

## Server Functions with Auth

Don't add auth middleware per function — the global middleware already runs. Read the
caller from `context.auth`, which is `{ status: "public" }` or
`{ status: "authorized", userId, email }`; check `status` before using the identity.
