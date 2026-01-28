# SaaS-on-CF (Software as a Service on Cloudflare) - User Application

Modular web application template - user application (frontend package)

## Architecture

Frontend application built with TanStack Start, featuring server-side rendering, authentication, and seamless integration with Cloudflare Workers and the data service.

- **`wrangler.jsonc`** - Definitions for Cloudflare primitives and service bindings.

### Directory Structure

#### [`src/server.ts`](./src/server.ts)
Custom Cloudflare Workers entry point. Initializes database connection and authentication setup.

- **Database initialization** - Connects to PostgreSQL via `@repo/data-ops`
- **Authentication setup** - Configures Better Auth with database adapter

#### [`src/router.tsx`](./src/router.tsx)
TanStack Router configuration with SSR query integration.

- **Route tree** - Auto-generated from file-based routing
- **Query integration** - TanStack Query SSR setup

#### [`src/routes/`](./src/routes/)
File-based routing with TanStack Router.

##### [`src/routes/__root.tsx`](./src/routes/__root.tsx)
Root layout component applied to all routes.

##### [`src/routes/_auth/`](./src/routes/_auth/)
Authenticated routes requiring user authentication.

- **`app/`** - Main application routes
  - **`polar/`** - Payment and subscription management (checkout, portal, subscriptions)

##### [`src/routes/_static/`](./src/routes/_static/)
Static content routes.

- **`docs/`** - Documentation pages

##### [`src/routes/api/`](./src/routes/api/)
API route handlers.

- **`auth.$.tsx`** - Better Auth API endpoints

#### [`src/core/`](./src/core/)
Core business logic and server functions.

##### [`src/core/functions/`](./src/core/functions/)
Server functions with middleware support.

- **`example-functions.ts`** - Sample server function

##### [`src/core/forms/`](./src/core/forms/)
TanStack Form definitions for form handling with server validation.

##### [`src/core/middleware/`](./src/core/middleware/)
Server-side middleware for authentication, validation, and more.

- **`auth.ts`** - Authentication middleware (includes `protectedFunctionMiddleware` and `protectedRequestMiddleware`)
- **`example-middleware.ts`** - Sample middleware

### Server Functions & Data Access

> **Detailed Reference:** See [docs/003-server-function-reference.md](../../docs/003-server-function-reference.md) for complete implementation guide.

#### What: Three Data Access Patterns

| Pattern | Flow | Use Case |
|---------|------|----------|
| **1. Server Fn → data-service** | Browser → Server Function → Service Binding → data-service API | CRUD with business logic, shared APIs |
| **2. Server Fn → data-ops** | Browser → Server Function → data-ops → Database | Auth, performance-critical, transactions |
| **3. Client → data-service** | Browser → data-service (public API) | Mobile apps, SPAs, real-time features |

#### How: Choosing the Right Pattern

```
                    Need server-side logic?
                           │
              ┌────────────┴────────────┐
              │ YES                     │ NO
              ▼                         ▼
    Is the operation also         Pattern 3:
    used by external APIs?        Client → data-service
              │                   (requires public API setup)
    ┌─────────┴─────────┐
    │ YES               │ NO
    ▼                   ▼
Pattern 1:          Pattern 2:
Server Fn →         Server Fn → data-ops
data-service        (direct database)
```

#### Why: Trade-offs

| Consideration | Pattern 1 (via data-service) | Pattern 2 (direct data-ops) | Pattern 3 (client direct) |
|--------------|------------------------------|----------------------------|--------------------------|
| **Latency** | Higher (2 hops) | Lower (1 hop) | Medium |
| **Code reuse** | Shares with external APIs | Frontend-specific | Shares with external APIs |
| **SSR support** | Yes | Yes | No |
| **Complexity** | Medium | Low | Low (but auth is harder) |

#### Quick Reference

| Operation Type | Recommended Pattern |
|----------------|-------------------|
| Auth/session | Pattern 2 (data-ops) |
| User CRUD | Pattern 1 (data-service) |
| Dashboard aggregations | Pattern 2 (data-ops) |
| Mobile API | Pattern 3 (client direct) |
| Admin operations | Pattern 1 (data-service) |

#### Form Handling

Two approaches for forms:

1. **TanStack Form + FormData** - For complex forms with validation
   - Progressive enhancement (works without JS)
   - Server + client validation
   - Requires: `@tanstack/react-form`, `@tanstack/react-form-start`

2. **Direct Server Functions** - For simple mutations
   - Use with TanStack Query (`useMutation`)
   - Good for delete buttons, toggles

#### [`src/components/`](./src/components/)
React components organized by feature.

##### [`src/components/auth/`](./src/components/auth/)
Authentication UI components.

- **`account-dialog.tsx`** - User account management dialog
- **`google-login.tsx`** - Google OAuth login button


##### [`src/components/ui/`](./src/components/ui/)
Shadcn/UI base components (buttons, cards, dialogs, etc.).

##### [`src/components/layout/`](./src/components/layout/)
Layout components (header, sidebar).

##### [`src/components/landing/`](./src/components/landing/)
Landing page components.

#### [`src/integrations/`](./src/integrations/)
Third-party integrations.

##### [`src/integrations/tanstack-query/`](./src/integrations/tanstack-query/)
TanStack Query setup and providers.

- **`root-provider.tsx`** - Query client provider
- **`devtools.tsx`** - Development tools

#### [`src/lib/`](./src/lib/)
Shared utilities and client libraries.

- **`auth-client.ts`** - Better Auth client configuration
- **`utils.ts`** - Utility functions

### Service Bindings vs Environment Variables

#### Service Bindings (Current Setup)

The application connects to `data-service` via **Cloudflare service bindings** - internal worker-to-worker communication.

```jsonc
// wrangler.jsonc
"services": [
  {
    "binding": "DATA_SERVICE",
    "service": "saas-on-cf-ds-dev"
  }
]
```

**Configuration per environment:**
- **dev**: `saas-on-cf-ds-dev`
- **staging**: `saas-on-cf-ds-staging`
- **production**: `saas-on-cf-ds-production`

**Usage in code:**
```typescript
import { env } from "cloudflare:workers";

const response = await env.DATA_SERVICE.fetch(
  new Request("https://internal/users")  // hostname ignored
);
```

**Benefits:**
- Faster (Cloudflare internal network, no public internet hop)
- More secure (`data-service` not publicly exposed)
- No CORS configuration needed
- No URL management per environment

#### When to Use Vars (Public API URLs)

Use `vars` only when you need **public API access** (mobile apps, third-party integrations):

```jsonc
// wrangler.jsonc - Only if exposing data-service publicly
"vars": {
  "PUBLIC_API_URL": "https://api.your-domain.com"
}
```

This would require:
1. Adding public routes to `data-service/wrangler.jsonc`
2. CORS middleware in `data-service`
3. Client-side auth token management

#### Comparison

| Aspect | Service Binding (`services`) | Env Var (`vars`) |
|--------|------------------------------|------------------|
| **Network** | Cloudflare internal | Public internet |
| **Speed** | Faster | Slower |
| **Security** | Private (not exposed) | Must secure endpoint |
| **Use case** | Server functions (Pattern 1) | Client direct calls (Pattern 3) |
| **Setup** | Just binding config | Routes + CORS + auth |

#### Recommendation

**Use service bindings** (current setup) for all server-side operations. Only add public API routes + vars when you actually need external client access.

### Environment Variables

Config files in `apps/user-application/`:
- `.env` - Local development (not committed)
- `.env.staging` - Staging environment
- `.env.production` - Production environment

Sample `.env.example` file with minimum number of values available - [.env.example](./.env.example)

Required variables:
- `CLOUDFLARE_ENV` - Current environment (dev/staging/production)
- `DATABASE_HOST` - PostgreSQL database host
- `DATABASE_USERNAME` - Database username
- `DATABASE_PASSWORD` - Database password
- `BETTER_AUTH_SECRET` - Authentication secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)

### Helper Scripts

Sync script - synchronize secrets with remote environment

```bash
chmod +x sync-secrets.sh
./sync-secrets.sh {env}
```

Example:
```bash
./sync-secrets.sh staging
./sync-secrets.sh production
```
