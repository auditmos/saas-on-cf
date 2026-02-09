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

## Sign In / Sign Up Forms (REQUIRED: TanStack Form + useMutation)

Never use raw `useState` for form state. Always use `useForm` from `@tanstack/react-form` + `useMutation` from `@tanstack/react-query`.

```tsx
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"

function SignInForm() {
  const navigate = useNavigate()

  // No onSuccess here — use mutateAsync + navigate in onSubmit
  const mutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const result = await authClient.signIn.email(data)
      if (result.error) throw new Error(result.error.message)
      return result
    },
  })

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      mutation.reset()
      await mutation.mutateAsync(value)
      navigate({ to: "/dashboard" })
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {mutation.isError && <Alert variant="destructive">{mutation.error.message}</Alert>}
      <form.Field
        name="email"
        validators={{ onChange: ({ value }) => !value ? "Required" : undefined }}
      >
        {(field) => (
          <Input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(s) => s.canSubmit}>
        {(canSubmit) => (
          <Button disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Loading..." : "Sign In"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
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
