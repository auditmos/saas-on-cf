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
│   ├── _auth/                # Protected routes (require auth)
│   ├── _static/              # Static content
│   ├── api/                  # API handlers (Better Auth)
│   └── demo/                 # Pattern demos (direct/binding/api)
├── core/
│   ├── functions/            # Server functions
│   │   └── users/            # User CRUD by pattern
│   │       ├── direct.ts     # → data-ops (DB)
│   │       └── binding.ts    # → DATA_SERVICE.fetch
│   └── middleware/           # Auth middleware
├── lib/
│   ├── api-client.ts         # Browser fetch → data-service
│   └── query-keys.ts         # TanStack Query keys + options
└── components/               # React components
```

## Data Access Patterns

| Pattern | File | Flow | SSR |
|---------|------|------|-----|
| **Direct** | `core/functions/users/direct.ts` | Server Fn → data-ops → DB | Yes |
| **Binding** | `core/functions/users/binding.ts` | Server Fn → `env.DATA_SERVICE.fetch` → data-service | Yes |
| **API** | `lib/api-client.ts` | Browser → fetch → data-service HTTP | No |

**Choose:**
- Direct: auth, performance-critical, complex transactions
- Binding: shared logic with external API, internal services
- API: mobile apps, SPAs, third-party clients

## Service Binding

```typescript
import { env } from 'cloudflare:workers';

// Internal call (hostname ignored)
const response = await env.DATA_SERVICE.fetch(
  new Request('https://data-service/users', {
    headers: { Authorization: `Bearer ${env.DATA_SERVICE_API_TOKEN}` }
  })
);
```

Configured in `wrangler.jsonc` per environment.

## Server Functions

```typescript
// With middleware
import { protectedFunctionMiddleware } from '@/core/middleware/auth';

const protectedFn = createServerFn().middleware([protectedFunctionMiddleware]);

export const myFn = protectedFn
  .validator((data) => MySchema.parse(data))
  .handler(async ({ data, context }) => {
    // context.session available
  });
```

## TanStack Query Keys

```typescript
import { userKeys, userDetailDirectQueryOptions } from '@/lib/query-keys';

// In route loader (SSR)
await context.queryClient.ensureQueryData(userDetailDirectQueryOptions(id));

// In component
const { data } = useQuery(userDetailDirectQueryOptions(id));
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
- `VITE_DATA_SERVICE_URL` - public API URL (API pattern only)
- `VITE_API_TOKEN` - client-side API auth (API pattern only)

## Don't

- Import `env` from 'cloudflare:workers' in client code (server only)
- Put DB queries here - add to `@repo/data-ops/queries`
- Skip `enabled: !!id` on detail queries (prevents empty ID fetches)
- Use useState for URL-driven state - use `validateSearch` + `useNavigate`
