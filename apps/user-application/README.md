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

##### [`src/core/middleware/`](./src/core/middleware/)
Server-side middleware for authentication, validation, and more.

- **`auth.ts`** - Authentication middleware (includes `protectedFunctionMiddleware` and `protectedRequestMiddleware`)
- **`example-middleware.ts`** - Sample middleware

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

### Service Bindings

The application connects to the data service via Cloudflare service bindings:

- **`DATA_SERVICE`** - Binding to the data service worker
  - **dev**: `saas-on-cf-ds-dev`
  - **staging**: `saas-on-cf-ds-staging`
  - **production**: `saas-on-cf-ds-production`

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
