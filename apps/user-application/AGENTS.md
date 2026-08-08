# user-application

TanStack Start frontend with SSR on Cloudflare Workers.

## Stack

- TanStack Start (Router + Query + Form)
- Cloudflare Workers with service bindings
- Better Auth for authentication
- Consumes `@repo/data-ops` for direct DB access and Zod schemas

## Structure

```
src/
├── server.ts                 # Worker entry, DB + auth init
├── router.tsx                # TanStack Router config
├── routes/                   # File-based routing
│   ├── __root.tsx            # Root layout
│   ├── index.tsx             # Landing page
│   ├── signin.tsx            # Sign in
│   ├── signup.tsx            # Sign up
│   ├── _auth/                # Protected routes (require auth)
│   └── api/                  # auth.$.tsx (Better Auth), health.ts
├── lib/
│   ├── utils.ts              # Shared utilities
│   ├── auth-client.ts        # Better Auth client
│   └── data-service.ts       # Service binding client (DATA_SERVICE)
└── components/               # React components
    ├── landing/              # Landing page sections
    ├── layout/               # Page shell
    ├── navigation/           # Nav bar
    ├── theme/                # Theme toggle + provider
    ├── auth/                 # Auth components
    └── ui/                   # Radix/shadcn primitives
```

## Dev

```bash
pnpm run dev                # local dev (port 3000)
pnpm run build              # build for production (default)
pnpm run build:staging      # build with staging config
pnpm run build:production   # build with production config
pnpm run deploy:staging     # build:staging + wrangler deploy
pnpm run deploy:production  # build:production + wrangler deploy
```

## Env vars

`.env` (local) or Cloudflare dashboard:
- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `CLOUDFLARE_ENV` - dev | staging | production
- `VITE_DATA_SERVICE_URL` - public API URL
- `VITE_API_TOKEN` - client-side API auth
- `DATA_SERVICE_API_TOKEN` - server-side bearer for the service binding

<important if="you are making server-side calls to data-service from user-application">
## Service Binding (DATA_SERVICE)

Use `fetchDataService()` from `lib/data-service.ts` for server-side calls via Worker service binding. Never call the public API URL from server code.

```ts
import { fetchDataService } from "@/lib/data-service";

const response = await fetchDataService("/health/live");
const data = await response.json();
```

- Server-only — uses `env` from `cloudflare:workers`
- No HTTP/DNS overhead — internal Worker-to-Worker RPC
- Health check: `GET /api/health` verifies binding, DB, and env
</important>

<important if="you are writing or moving tests in user-application">
## Two test projects

| File suffix | Config | Runtime | Use for |
|---|---|---|---|
| `*.test.ts` | `vitest.config.ts` | Node | Pure server-side logic. `cloudflare:workers` is aliased to the stub in `src/test/cloudflare-workers.ts`. |
| `*.workers.test.ts` | `vitest.workers.config.mts` | workerd | Anything whose behaviour **is** the runtime's: service bindings, isolate-local module state, platform globals. Nothing is stubbed. |

Both run under root `pnpm run test`. Bindings for the workerd project are declared
inline in `vitest.workers.config.mts`, not read from `wrangler.jsonc` — the deployed
config points `main` at the Start server entry, which only builds through the Vite plugin.

If a behaviour can be stated correctly in Node, keep it in the Node project; it is
an order of magnitude faster to run.
</important>

## Don't

- Import `env` from 'cloudflare:workers' in client code (server only)
- Put DB queries here - add to `@repo/data-ops/{domain}`
- Skip `enabled: !!id` on detail queries (prevents empty ID fetches)
- Use useState for URL-driven state - use `validateSearch` + `useNavigate`
