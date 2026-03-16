# Universal TypeScript Rules

## Type Safety

- Never use `any`—create explicit interfaces/types
- Prefer `unknown` over `any`, narrow with type guards
- Use `satisfies` for type-safe object literals with inference
- Use `as const` for readonly literal types
- Prefer discriminated unions over boolean flags

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

## Naming

- Interfaces: `PascalCase` (no `I` prefix)
- Types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for true constants
- Files: `kebab-case.ts`
- Explicit return types on public APIs

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

# Universal Cloudflare Rules

- Use `wrangler.jsonc` instead of `wrangler.toml` for configuration

# Universal Programming Rules

## Bug Fix Workflow

When a bug is reported:
1. Write a failing test that reproduces the bug — do not touch implementation yet
2. Show the failing test and propose a fix — wait for approval
3. Implement the fix — the test should now pass
4. Run full test suite to confirm no regressions
