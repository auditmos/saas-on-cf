---
paths:
  - "packages/data-ops/**/*.ts"
---

# Neon Database Rules

## Connection Setup

- Use `@neondatabase/serverless` for edge/serverless
- Connection string from environment, never hardcode
- Use `getDb()` factory for connection management

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

export function getDb(connectionString: string) {
  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}
```

## Environment Configuration

- Separate connection strings per environment
- Use `DATABASE_URL` env var naming
- Configure in `wrangler.jsonc` for CF Workers

```ts
// Access in worker
const db = getDb(env.DATABASE_URL)
```

## Serverless Patterns

- Neon autoscales—no connection pooling config needed
- Each request gets fresh connection (stateless)
- Queries execute at edge, close to users
- Keep queries efficient—minimize round trips

## Branching (Dev/Preview)

- Use Neon branches for isolated dev/preview environments
- Main branch = production
- Create branches for feature development
- Branches share compute, minimize costs

## Best Practices

- Avoid long-running transactions in serverless
- Use single queries over multiple round trips
- Leverage Drizzle's 1-query output for efficiency
- Monitor query performance via Neon dashboard
