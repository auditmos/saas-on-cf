---
paths:
  - "packages/data-ops/**/*.ts"
---

# Drizzle ORM Rules

## Schema Definition

- Use `pgTable()` with explicit column types
- Define tables in `{domain}/table.ts`
- Define relations in separate `drizzle/relations.ts`
- Never edit auto-generated files (e.g., `auth-schema.ts`)

```ts
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

## Type Inference

- Use `InferSelectModel<typeof table>` for select types
- Use `InferInsertModel<typeof table>` for insert types
- Export types alongside tables

```ts
export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
```

## Query Patterns

- Use SQL-like API for complex queries with joins
- Use relational API (`db.query.*`) for nested data
- Always use `eq()`, `and()`, `or()` helpers
- Drizzle outputs exactly 1 SQL query—leverage for serverless

```ts
// SQL-like
const result = await db.select().from(users)
  .leftJoin(posts, eq(posts.authorId, users.id))
  .where(eq(users.id, userId))

// Relational
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { posts: true }
})
```

## Migrations

- Never manually edit generated migration files
- Use environment-specific configs: `drizzle-{dev,staging,production}.config.ts`
- Run `drizzle:*:generate` then `drizzle:*:migrate`
- Test migrations on dev/staging before production

## Error Handling

- Drizzle wraps DB errors in `DrizzleQueryError` — original Postgres error is in `error.cause`, NOT `error.message`
- `error.message` = `"Failed query: <SQL>\nparams: <values>"` — never contains constraint info
- Check `error.cause.code` for Postgres error codes (e.g. `23505` = unique violation)

```ts
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  if (cause instanceof Error) {
    const pgCode = (cause as Error & { code?: string }).code;
    if (pgCode === '23505') return true;
  }
  return false;
}
```

## Queries Module

- Place queries in `{domain}/queries.ts`
- Accept `db` as first parameter for testability
- Return typed results

```ts
export async function getUserById(db: Database, id: string): Promise<User | null> {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}
```
