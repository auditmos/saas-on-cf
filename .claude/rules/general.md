# Universal TypeScript Rules

## Type Safety

- Never use `any`—create explicit interfaces/types
- Prefer `unknown` over `any`, narrow with type guards
- Use `satisfies` for type-safe object literals with inference
- Use `as const` for readonly literal types
- Prefer discriminated unions over boolean flags
- Export types alongside implementations

```ts
// Good: discriminated union
type Result<T> = { ok: true; data: T } | { ok: false; error: Error }

// Bad: boolean flag
type Result<T> = { success: boolean; data?: T; error?: Error }
```

## Error Handling

- Create custom error classes extending `Error`
- Never `throw new Error(string)`—use typed errors
- Use `Result<T>` pattern for recoverable errors
- Let unexpected errors propagate for logging

```ts
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

## Functions & Modules

- Named exports over default exports
- Pure functions where possible
- Single responsibility per function
- Explicit return types on public APIs

## Naming

- Interfaces: `PascalCase` (no `I` prefix)
- Types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for true constants
- Files: `kebab-case.ts`

## Array Access

- Always guard `array[i]` access — it returns `T | undefined`
- Use `for...of` when index isn't needed
- When index IS needed, add a guard:

```ts
// Bad
for (let i = 0; i < items.length; i++) {
  doSomething(items[i].name) // possibly undefined
}

// Good
for (const item of items) {
  doSomething(item.name)
}

// Good (when index needed)
for (let i = 0; i < items.length; i++) {
  const item = items[i]
  if (!item) continue
  doSomething(item.name)
}
```

## Async Patterns

- Prefer `async/await` over `.then()` chains
- Handle errors at appropriate boundaries
- Use `Promise.all()` for parallel independent operations
- Avoid nested promises

## Imports

- Group: external → internal → relative
- Absolute imports via path aliases when configured
- Avoid circular dependencies

# Universal Cloudflare Rules

- Use `wrangler.jsonc` instead of `wrangler.toml` for configuration

# Universal Programming Rules

- When I report a bug, don't start by trying to fix it. Instead, start by writing a test that reproduces the bug.