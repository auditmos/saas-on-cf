# Change 3: query-keys factory

Dependencies: 001-domain-barrels (import paths change), 003-app-error (route files also change there)

## Modify `lib/query-keys.ts`

Replace 6 explicit query option exports with factory:

```ts
interface EntityKeys {
  detail: (id: string) => readonly unknown[]
  list: (params: PaginationParams) => readonly unknown[]
}

interface EntityQueryConfig<TDetail, TList> {
  keys: EntityKeys
  fns: {
    getOne: (id: string) => Promise<TDetail>
    getList: (params: PaginationParams) => Promise<TList>
  }
  overrides?: {
    detail?: Partial<UseQueryOptions>
    list?: Partial<UseQueryOptions>
  }
}

function createEntityQueryOptions<TDetail, TList>(config: EntityQueryConfig<TDetail, TList>) { ... }

export const clientDirectQueries = createEntityQueryOptions<Client | null, ClientListResponse>({ ... })
export const clientBindingQueries = createEntityQueryOptions<Client | null, ClientListResponse>({ ... })
export const clientApiQueries = createEntityQueryOptions<Client | null, ClientListResponse>({ ... })
```

Keep `clientKeys` factory as-is (still useful for invalidation).

## Update route files (~12 files)

```ts
// Before: clientDetailDirectQueryOptions(id)
// After:  clientDirectQueries.detail(id)

// Before: clientsListBindingQueryOptions(params)
// After:  clientBindingQueries.list(params)
```

Import changes: `clientDetailDirectQueryOptions` -> `clientDirectQueries`, etc.

## Resolved decisions

1. **API routes inline queries** -- migrate now to `clientApiQueries.*` for consistency

## Verification

```bash
pnpm run lint
pnpm run lint:fix
pnpm run dev:user-application # smoke test all 15 dashboard pages
```
