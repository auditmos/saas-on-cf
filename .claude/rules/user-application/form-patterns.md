---
paths:
  - "apps/user-application/**/*.{ts,tsx}"
---

# Form Patterns (TanStack Form + React Query)

Never use raw `useState` for form state. Always use `useForm` + `form.Field` + `form.Subscribe`.
Pair with `useMutation` for async submissions.

## Template

```tsx
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'

function CreateForm() {
  const mutation = useMutation({
    mutationFn: createEntity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entityKeys.all }),
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

## mutate vs mutateAsync

- `mutate()` = fire-and-forget. Use for in-place UI updates (cache invalidation via `onSuccess`)
- `mutateAsync()` = awaitable. Use when you need to act after completion (navigate, redirect)

```ts
// mutateAsync — navigate after success
onSubmit: async ({ value }) => {
  mutation.reset()
  await mutation.mutateAsync(value)
  navigate({ to: '/dashboard' })
}
```

## Schema Alignment

Form `defaultValues` must include all required fields from mutation's input schema. If a Zod schema has `.default()` (e.g. `active: z.boolean().default(true)`), output type makes it required — pass explicitly in `onSubmit`:

```ts
mutation.mutate({ ...value, active: true })
```
