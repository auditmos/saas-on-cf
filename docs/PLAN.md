# Deep Modules Refactor

Three changes: domain barrels in data-ops, unified error handling, query-keys factory.

## Execution order

```
001-domain-barrels  ──┬──> 002-result-pattern
                      ├──> 003-app-error
                      └──> 004-query-keys-factory (also depends on 003)
```

1. [001-domain-barrels](./001-domain-barrels.md) -- data-ops domain barrels (everything depends on it)
2. [002-result-pattern](./002-result-pattern.md) -- data-service Result pattern
3. [003-app-error](./003-app-error.md) -- user-application AppError + thrown errors
4. [004-query-keys-factory](./004-query-keys-factory.md) -- query-keys factory

## Final verification

```bash
pnpm --filter @repo/data-ops build
pnpm run lint
pnpm run lint:fix
pnpm run dev:data-service
pnpm run dev:user-application
```
