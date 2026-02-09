---
paths:
  - "apps/user-application/**/*.{ts,tsx}"
---

# TanStack Rules (Start, Router, Query, Form)

## TanStack Start - Server Functions

Use `createServerFn` for server-side logic:

```ts
import { createServerFn } from '@tanstack/react-start'

export const getUser = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    return getUserById(data.id)
  })
```

## TanStack Router - File-Based Routing

- Routes in `routes/` directory
- `__root.tsx` for root layout
- `_layout/` prefix for layout routes
- `$param` for dynamic segments

```
routes/
├── __root.tsx           # Root layout
├── index.tsx            # /
├── _auth/               # Layout group (auth required)
│   ├── dashboard.tsx    # /dashboard
│   └── settings.tsx     # /settings
└── users/
    ├── index.tsx        # /users
    └── $userId.tsx      # /users/:userId
```

## Router - Route Definition

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params }) => {
    return getUser({ data: { id: params.userId } })
  },
  component: UserPage,
})

function UserPage() {
  const user = Route.useLoaderData()
  return <div>{user.name}</div>
}
```

## TanStack Query - Query Options

Use `queryOptions` for reusable, type-safe queries:

```ts
import { queryOptions } from '@tanstack/react-query'

export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId),
  })

// In component
const { data } = useSuspenseQuery(userQueryOptions(userId))
```

## Query - Key Factories

```ts
export const queryKeys = {
  users: {
    all: ['users'] as const,
    list: (filters: Filters) => [...queryKeys.users.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },
}
```

## Query - Mutations

- `mutate()` = fire-and-forget. Use for in-place UI updates (success alerts, cache invalidation via `onSuccess` callback)
- `mutateAsync()` = awaitable. Use inside `onSubmit` when you need to act after completion (navigate, redirect, reset form)

```ts
// mutate — stay on page, show result
const mutation = useMutation({
  mutationFn: createClient,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.all }),
})
form.onSubmit: mutation.mutate(value)

// mutateAsync — navigate after success
form.onSubmit: async ({ value }) => {
  const result = await mutation.mutateAsync(value)
  navigate({ to: '/dashboard' })
}
```

## TanStack Form - REQUIRED for All Forms

Never use raw `useState` for form state. Always use `useForm` + `form.Field` + `form.Subscribe`.
Pair with `useMutation` for async submissions.

```tsx
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'

function CreateForm() {
  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.all }),
  })

  const form = useForm({
    defaultValues: { name: '', email: '' },
    onSubmit: async ({ value }) => {
      mutation.reset()
      mutation.mutate(value)
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
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
```

## SSR Patterns

- Use loaders for initial data (SSR)
- Hydrate query cache from loader data
- Prefer server functions over client fetch for SSR'd data
