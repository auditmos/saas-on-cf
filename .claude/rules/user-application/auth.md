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

## Sign In Patterns

```tsx
function SignInForm() {
  const [error, setError] = useState<string>()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await signIn.email({
      email,
      password,
    })
    if (result.error) {
      setError(result.error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert variant="error">{error}</Alert>}
      {/* fields */}
    </form>
  )
}
```

## OAuth

```tsx
<button onClick={() => signIn.social({ provider: 'google' })}>
  Sign in with Google
</button>
```

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
