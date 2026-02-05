---
paths:
  - "apps/user-application/**/*.tsx"
---

# React 19 Rules

## Component Structure

- Props interface above component
- Named exports
- Keep components focused

```tsx
interface UserCardProps {
  user: User
  onSelect?: (id: string) => void
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div onClick={() => onSelect?.(user.id)}>
      {user.name}
    </div>
  )
}
```

## Hooks

- Custom hooks start with `use`
- Extract complex logic into hooks
- Return stable references

```tsx
export function useUser(id: string) {
  const query = useSuspenseQuery(userQueryOptions(id))
  return query.data
}
```

## State Management

- Lift state only when needed
- Use composition over prop drilling
- Context for truly global state (theme, auth)

```tsx
// Prefer composition
<UserList>
  {users.map(u => <UserCard key={u.id} user={u} />)}
</UserList>

// Over prop drilling
<UserList users={users} renderItem={(u) => <UserCard user={u} />} />
```

## Event Handlers

- Inline for simple handlers
- Extract for complex logic or reuse

```tsx
// Simple - inline
<button onClick={() => setOpen(true)}>Open</button>

// Complex - extract
const handleSubmit = useCallback(async () => {
  await mutation.mutateAsync(data)
  navigate({ to: '/success' })
}, [data, mutation, navigate])
```

## Conditional Rendering

```tsx
// Ternary for simple
{isLoading ? <Spinner /> : <Content />}

// Early return for complex
if (error) return <ErrorState error={error} />
if (!data) return <EmptyState />
return <DataView data={data} />
```

## Lists

- Always use stable `key` props
- Prefer `id` over array index

```tsx
{users.map(user => (
  <UserCard key={user.id} user={user} />
))}
```

## React 19 Features

- Use Transitions for non-urgent updates
- Leverage Suspense boundaries
- Use `use()` hook for promises in render (experimental)

```tsx
function App() {
  return (
    <Suspense fallback={<Loading />}>
      <UserProfile />
    </Suspense>
  )
}
```
