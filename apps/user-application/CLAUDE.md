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
│   ├── faq/$categoryId.tsx   # Dynamic FAQ pages
│   ├── _auth/                # Protected routes (require auth)
│   └── api/                  # API handlers (Better Auth)
├── lib/
│   ├── utils.ts              # Shared utilities
│   ├── auth-client.ts        # Better Auth client
│   └── data-service.ts       # Service binding client (DATA_SERVICE)
└── components/               # React components
    ├── landing/              # Landing page sections
    ├── faq/                  # FAQ page component
    ├── navigation/           # Nav bar
    ├── theme/                # Theme toggle + provider
    ├── auth/                 # Auth components
    └── ui/                   # Radix/shadcn primitives
```

## Dev

```bash
pnpm run dev              # local dev (port 3000)
pnpm run build            # build for production
pnpm run deploy:dev       # deploy to dev
pnpm run deploy:staging   # deploy to staging
pnpm run deploy:prod      # deploy to production
```

## Env vars

`.env` (local) or Cloudflare dashboard:
- `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `CLOUDFLARE_ENV` - dev | staging | production
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional, OAuth)
- `VITE_DATA_SERVICE_URL` - public API URL
- `VITE_API_TOKEN` - client-side API auth

## Service Binding (DATA_SERVICE)

Use `fetchDataService()` from `lib/data-service.ts` for server-side calls to data-service via Worker service binding. Never call the public API URL from server code.

```ts
import { fetchDataService } from "@/lib/data-service";

const response = await fetchDataService("/health/live");
const data = await response.json();
```

- Server-only — uses `env` from `cloudflare:workers`
- No HTTP/DNS overhead — internal Worker-to-Worker RPC
- Health check: `GET /api/health` verifies binding, DB, and env

## Error Handling

- `AppError` in `core/errors.ts` -- single error class for all server functions and API calls
- Constructor: `new AppError(message, code, status?, field?)`
- Server functions (direct/binding) throw `AppError` instead of returning discriminated unions
- `api-client.ts` throws `AppError` on `!response.ok`
- Route components use `mutation.isError` / `mutation.error.message` (not `mutation.data.success`)
- Drizzle error unwrapping + unique violation: see `error-handling.md` rule

## Don't

- Import `env` from 'cloudflare:workers' in client code (server only)
- Call data-service via public URL from server code — use `fetchDataService()` instead
- Put DB queries here - add to `@repo/data-ops/{domain}`
- Skip `enabled: !!id` on detail queries (prevents empty ID fetches)
- Use useState for URL-driven state - use `validateSearch` + `useNavigate`
