# Deep Modules

A deep module (Ousterhout) has a small interface hiding a large implementation.
Deep modules are more testable, more AI-navigable, and let you test at the boundary.

## Principles

- Interface = exports, function signatures, props. Keep narrow.
- Implementation = internal logic. Absorb complexity here.
- Shallow modules (many tiny files doing little) increase system complexity.
- Before creating a new file: does this deepen an existing module or widen its interface?
- Before exporting a function: does the caller need this or is it internal?

## Module Boundaries in This Repo

| Layer | Module boundary | Interface (narrow) | Hides (deep) |
|-------|----------------|-----------|-------|
| DB domain | `data-ops/src/{domain}/index.ts` | Exported queries + Zod schemas + types | Table defs, query builders, pagination logic |
| API endpoint | `data-service/src/hono/` | HTTP routes on `Hono` app | Validation, error mapping, Result unwrapping |
| Server fn | `user-application/src/core/functions/{domain}/` | `createServerFn` signature | Auth checks, API calls, transforms |
| Component feature | `user-application/src/components/{feature}/` | Props + named export | State, mutations, query hooks, UI logic |
| Integration | `user-application/src/integrations/` | Thin wrapper export | Provider config, client setup |

## Applying to This Codebase

- `data-ops` domains already follow this: `index.ts` barrel re-exports only what consumers need from `table.ts`, `schema.ts`, `queries.ts`. Keep it that way.
- `data-service` Hono routes should stay in single files per resource — don't split validation/mapping into separate files unless the route file exceeds 500 lines.
- `user-application` server functions: one file per domain per mode (`direct.ts`, `binding.ts`). Don't extract helpers unless reused across domains.
- Components: colocate hooks, state, and sub-components in the feature folder. Only export the top-level component from the folder's index.

## When to Split

Split a module only when:
1. File exceeds 500 lines (repo rule)
2. Two genuinely independent responsibilities share a file
3. A chunk is reused by multiple unrelated modules

Do NOT split just because a file "does a lot" — that's depth, which is good.

## Testing Corollary

Test at the module boundary, not internals:

| Layer | Test via |
|-------|----------|
| DB domain (`data-ops`) | Exported query functions against real DB |
| API (`data-service`) | HTTP requests to Hono app |
| Components | User interactions (Testing Library) |
| Server fns | Function call with mocked bindings |

If you must test an internal → the module should probably split.
