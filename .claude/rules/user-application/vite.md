---
paths:
  - "apps/user-application/**/*.{ts,tsx}"
---

# Vite & Cloudflare Vite Plugin Rules

## JSON Response Parsing (Critical)

Never use shared Zod schemas with `z.date()` to parse JSON from data-service — JSON serializes dates as ISO strings. Use `z.coerce.date()`, `z.string().datetime()`, or minimal pick schemas.

## Env Vars — `.env` files (NOT `.dev.vars`)

user-application uses `.env` approach. If `.dev.vars` exists, `.env` is ignored — never mix both.

**Loading precedence:** `.env.<mode>.local` > `.env.local` > `.env.<mode>` > `.env`

**Cloudflare env selection:** put `CLOUDFLARE_ENV=staging` in `.env.staging`, then `vite build --mode staging` auto-selects it.

### Server-side (Worker `env`)

All vars from `.env` are available on the Worker `env` object from `cloudflare:workers`. This project prefixes them with `VITE_`:

```ts
import { env } from 'cloudflare:workers'
env.VITE_DATA_SERVICE_API_TOKEN  // correct
env.VITE_DATA_SERVICE_URL        // correct
env.DATA_SERVICE_API_TOKEN       // WRONG — does not exist
```

### Client-side (browser)

Only `VITE_`-prefixed vars are exposed to client code via `import.meta.env.VITE_*`.

### Verify names before use

Always check `worker-configuration.d.ts` (`Cloudflare.Env` interface) for actual var names. Run `pnpm cf-typegen` to regenerate after changing wrangler.jsonc or `.env`.

## Cloudflare Vite Plugin Config

```ts
import { cloudflare } from '@cloudflare/vite-plugin'

cloudflare({
  viteEnvironment: { name: 'ssr' }, // required for TanStack Start
})
```

- Plugin reads wrangler.jsonc automatically — no path config needed
- Service bindings, KV, R2, etc. resolved from wrangler.jsonc `env` blocks
- `CLOUDFLARE_ENV` selects which env block to use

## Service Bindings

`DATA_SERVICE` is a Worker service binding (Fetcher type), not a URL.

```ts
// Worker-to-Worker RPC — hostname is synthetic, only path matters
env.DATA_SERVICE.fetch(
  new Request(`https://data-service${path}`, init)
)
```

## Secrets

- Never put secrets in `vars` in wrangler.jsonc — use `.env` files (gitignored)
- Remote secrets: set via Cloudflare dashboard or `wrangler secret put`

