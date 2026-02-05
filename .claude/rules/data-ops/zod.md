---
paths:
  - "packages/data-ops/**/*.ts"
---

# Zod v4 Rules

## Schema Definition

- Define schemas in `zod-schema/*.ts`
- Derive types with `z.infer<typeof Schema>`
- Use descriptive schema names ending in `Schema`

```ts
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
})

export type User = z.infer<typeof userSchema>
```

## Validation Patterns

- Use `safeParse()` for error handling, not `parse()`
- Return structured results, don't throw

```ts
const result = userSchema.safeParse(input)
if (!result.success) {
  return { ok: false, errors: result.error.flatten() }
}
return { ok: true, data: result.data }
```

## Schema Composition

- Use `.extend()` to add fields
- Use `.pick()` / `.omit()` for partial schemas
- Use `.merge()` to combine schemas
- Use `.partial()` for optional fields

```ts
const createUserSchema = userSchema.omit({ id: true })
const updateUserSchema = userSchema.partial().required({ id: true })
```

## Common Patterns

```ts
// Enums
const statusSchema = z.enum(['active', 'inactive', 'pending'])

// Arrays with constraints
const tagsSchema = z.array(z.string()).min(1).max(10)

// Optional with default
const limitSchema = z.number().int().positive().default(10)

// Transform
const trimmedString = z.string().transform(s => s.trim())

// Refinements
const passwordSchema = z.string()
  .min(8)
  .refine(p => /[A-Z]/.test(p), 'Must contain uppercase')
  .refine(p => /[0-9]/.test(p), 'Must contain number')
```

## Integration with Drizzle

- Create separate Zod schemas for validation (don't derive from Drizzle)
- Use Zod for input validation, Drizzle types for DB operations
- Keep schemas in sync manually or via codegen
