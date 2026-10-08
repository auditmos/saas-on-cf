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
Authenticated routes. [`route.tsx`](./src/routes/_auth/route.tsx) is the server-side guard: a signed-out request is redirected to `/signin`, and a signed-in but unapproved user sees the pending-approval screen.

- **`app/`** - Placeholder for your application's own routes
- **`dashboard/`** - Demo of the three data-access patterns, one CRUD set each: `direct/`, `binding/`, `api/`

##### Public routes

- **`index.tsx`** - Landing page
- **`signin.tsx`**, **`signup.tsx`** - Email and password sign-in and sign-up

##### [`src/routes/api/`](./src/routes/api/)
API route handlers.

- **`auth.$.tsx`** - Better Auth API endpoints
- **`health.ts`** - Health check

#### [`src/core/`](./src/core/)
Core business logic and server functions.

##### [`src/core/functions/`](./src/core/functions/)
Server functions.

- **`auth/session.ts`** - `getAuthView`, the session check the `_auth` guard calls
- **`clients/direct.ts`** - Demo CRUD straight against `@repo/data-ops` (Pattern 2)
- **`clients/binding.ts`** - Demo CRUD through the `DATA_SERVICE` service binding (Pattern 1)
- **`example-functions.ts`** - Sample server function with its own middleware

##### [`src/core/middleware/`](./src/core/middleware/)
Server-side middleware.

- **`auth.ts`** - `protectedFunctionMiddleware`, registered globally in [`src/start.tsx`](./src/start.tsx) so every server function requires an approved session
- **`example-middleware.ts`** - Sample middleware that adds to the context

##### Other modules

- **[`public-server-fns.ts`](./src/core/public-server-fns.ts)** - The complete list of server functions reachable without a session
- **[`errors.ts`](./src/core/errors.ts)** - `AppError`, see [Error Handling](#error-handling)
- **[`auth-view.ts`](./src/core/auth-view.ts)** - Maps a session to signed-out / pending / authorized

### Server Functions & Data Access

> **Demo Routes:** [`src/routes/_auth/dashboard/`](./src/routes/_auth/dashboard/) implements each pattern: `direct/` is Pattern 2, `binding/` is Pattern 1, `api/` is Pattern 3.

#### Three Data Access Patterns

| Pattern | Flow | Use Case |
|---------|------|----------|
| **1. Server Fn → data-service** | Browser → Server Function → Service Binding → data-service API | CRUD with business logic, shared APIs |
| **2. Server Fn → data-ops** | Browser → Server Function → data-ops → Database | Auth, performance-critical, transactions |
| **3. Client → data-service** | Browser → data-service (public API) | Mobile apps, SPAs, real-time features |

#### Choosing the Right Pattern

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

#### Pattern Trade-offs

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

---

### TanStack Form

`@tanstack/react-form` is installed and used by every create, read and update demo and by [`email-auth.tsx`](./src/components/auth/email-auth.tsx). The form holds field state and client-side validators; submitting hands the values to a TanStack Query mutation, which calls a server function (or the browser API client). Server-side validation is the server function's `.validator()` parsing the shared Zod schema — the form does not submit `FormData`, so it needs JavaScript.

#### Form Setup Pattern

From [`dashboard/direct/create.tsx`](./src/routes/_auth/dashboard/direct/create.tsx):

```typescript
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientDirect } from "@/core/functions/clients/direct";
import { clientKeys } from "@/lib/query-keys";

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (data: { name: string; surname: string; email: string }) =>
    createClientDirect({ data }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.all });
    form.reset();
  },
});

const form = useForm({
  defaultValues: { name: "", surname: "", email: "" },
  onSubmit: async ({ value }) => {
    mutation.reset();
    mutation.mutate(value);
  },
});
```

#### Field Validators

```typescript
<form.Field
  name="email"
  validators={{
    // Runs on every change
    onChange: ({ value }) => {
      if (!value) return "Required";
    },
    // Runs when field loses focus
    onBlur: ({ value }) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Invalid email";
      }
    },
    // Async validation (debounced)
    onChangeAsync: async ({ value }) => {
      await new Promise((r) => setTimeout(r, 500));
      const exists = await checkEmailExists(value);
      return exists ? "Email already registered" : undefined;
    },
    onChangeAsyncDebounceMs: 500,
  }}
>
```

#### Form-Level Validation

```typescript
const form = useForm({
  ...formOpts,
  validators: {
    onChange: ({ value }) => {
      if (value.password !== value.confirmPassword) {
        return "Passwords do not match";
      }
    },
  },
});
```

#### Subscribing to Form State

```typescript
// Subscribe to specific state slices for performance
<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
  {([canSubmit, isSubmitting]) => (
    <button disabled={!canSubmit}>{isSubmitting ? "..." : "Submit"}</button>
  )}
</form.Subscribe>

// Or use useStore for more complex subscriptions
const errors = useStore(form.store, (state) => state.errors);
const isDirty = useStore(form.store, (state) => state.isDirty);
```

---

### Direct Server Functions (Simple Mutations)

For simple mutations (delete, toggle) call a server function from a TanStack Query mutation, with no form. Authentication needs no code here: the global middleware already requires an approved session (see [Middleware Patterns](#middleware-patterns)).

From [`core/functions/clients/binding.ts`](./src/core/functions/clients/binding.ts), where `makeBindingRequest` calls the data-service over the `DATA_SERVICE` binding with `DATA_SERVICE_API_TOKEN`, and `throwOnError` re-raises its error body as an `AppError`:

```typescript
const DeleteClientInput = z.object({ id: z.string().min(1) });

export const deleteClientBinding = createServerFn({ method: "POST" })
  .validator((data: unknown) => DeleteClientInput.parse(data))
  .handler(async (ctx): Promise<void> => {
    const response = await makeBindingRequest(`/clients/${ctx.data.id}`, {
      method: "DELETE",
    });

    if (!response.ok) await throwOnError(response, "Failed to delete client");
  });
```

#### With TanStack Query

```typescript
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteClientBinding({ data: { id } }),
  onSuccess: () => {
    // Key factories live in `src/lib/query-keys.ts` — invalidate through them
    // rather than retyping the array, so a key change cannot miss a call site.
    queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
  },
});

<button onClick={() => deleteMutation.mutate(clientId)}>
  {deleteMutation.isPending ? "Deleting..." : "Delete"}
</button>
```

---

### Zod Schema Patterns

Schemas live with their domain in `@repo/data-ops` and are shared by both apps. The demo domain is `client`: [`packages/data-ops/src/client/schema.ts`](../../packages/data-ops/src/client/schema.ts), imported as `@repo/data-ops/client`.

#### Schema Types

| Kind | Exports |
|------|---------|
| Domain (what a record looks like) | `ClientSchema` |
| Requests (what a caller sends) | `ClientCreateRequestSchema`, `ClientUpdateRequestSchema`, `PaginationRequestSchema`, `IdParamSchema` |
| Responses | `ClientListResponseSchema`, `PaginationMetaSchema`, `ErrorResponseSchema` |
| Inferred types | `Client`, `ClientCreateInput`, `ClientUpdateInput`, `PaginationRequest`, `ClientListResponse`, `ErrorResponse` |

```typescript
export const ClientCreateRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name must be at most 30 characters"),
  surname: z
    .string()
    .min(1, "Surname is required")
    .max(30, "Surname must be at most 30 characters"),
  email: z.string().email("Invalid email format"),
});
```

#### Using in Server Functions

```typescript
import { ClientCreateRequestSchema, type ClientCreateInput } from "@repo/data-ops/client";

export const createClientDirect = createServerFn({ method: "POST" })
  .validator((data: unknown): ClientCreateInput => ClientCreateRequestSchema.parse(data))
  .handler(async (ctx) => {
    // ctx.data is typed and validated
  });
```

---

### Middleware Patterns

#### Authentication Middleware

Server functions are public HTTP endpoints, so authentication is the default rather than something each function opts into. [`src/start.tsx`](./src/start.tsx) registers `protectedFunctionMiddleware` as global `functionMiddleware`:

```typescript
export const startInstance = createStart(() => {
  return {
    defaultSsr: true,
    functionMiddleware: [protectedFunctionMiddleware],
  };
});
```

A new server function is therefore protected without any auth code. Its handler receives `context.auth`, which is `{ status: "authorized", userId, email }` for an approved session. A missing session throws `UNAUTHENTICATED` (401); an unapproved account throws `NOT_APPROVED` (403).

To make a function reachable anonymously, add it to `PUBLIC_SERVER_FNS` in [`public-server-fns.ts`](./src/core/public-server-fns.ts) with the reason, and update the expected list in [`scripts/server-fn-enumeration.test.ts`](../../scripts/server-fn-enumeration.test.ts) — the test fails until you do, so opening an endpoint is always visible in review. Its handler then sees `context.auth.status === "public"`.

#### Custom Context Middleware

Per-function middleware runs in addition to the global one. From [`example-middleware.ts`](./src/core/middleware/example-middleware.ts) and [`example-functions.ts`](./src/core/functions/example-functions.ts):

```typescript
export const exampleMiddlewareWithContext = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  return await next({
    context: {
      data: "Some Data From Middleware",
    },
  });
});

const baseFunction = createServerFn().middleware([exampleMiddlewareWithContext]);

export const examplefunction = baseFunction
  .validator((data: ExampleInput) => ExampleInputSchema.parse(data))
  .handler(async (_ctx) => {
    return "Function executed successfully";
  });
```

---

### Error Handling

#### One error class

There is a single error type in this app — [`AppError`](./src/core/errors.ts).
Not a hierarchy of `NotFoundError` / `ForbiddenError` / `ConflictError`: the
thing a caller branches on is the `code`, and a subclass per code buys nothing
once the error crosses a network boundary (see below), where the class name is
gone but the code survives.

```typescript
new AppError(message, code, status?, field?)
```

| Field | Purpose |
|-------|---------|
| `message` | Shown to the user as-is — write it for them, not for a log |
| `code` | What the caller branches on, e.g. `NOT_FOUND`, `EMAIL_EXISTS` |
| `status` | HTTP status, when one applies |
| `field` | Which input the message belongs to, e.g. `"email"` — populated, not yet read |

#### Where it gets thrown

Three places, each turning something foreign into an `AppError`:

**Auth middleware** ([`core/middleware/auth.ts`](./src/core/middleware/auth.ts))
— the two states are kept distinct on purpose, because the interface renders a
pending-approval screen for one and a signed-out screen for the other:

```typescript
throw new AppError("Authentication required", "UNAUTHENTICATED", 401);
throw new AppError("Account pending approval", "NOT_APPROVED", 403);
```

**Direct server functions** ([`core/functions/clients/direct.ts`](./src/core/functions/clients/direct.ts))
— translating a driver error into something a user can read. Drizzle puts the
Postgres error in `error.cause`, never in `error.message` (which only ever holds
the failed SQL), so the constraint check reads the pg code through
`isUniqueViolation` from `@repo/data-ops/database/errors` rather than matching
on a string:

```typescript
import { isUniqueViolation } from "@repo/data-ops/database/errors";

try {
  const client = await createClient(ctx.data);
  return ClientSchema.parse(client);
} catch (error) {
  if (isUniqueViolation(error)) {
    throw new AppError("Email already exists", "EMAIL_EXISTS", 409, "email");
  }
  throw new AppError("Failed to create client", "UNKNOWN", 500);
}
```

**HTTP boundaries** — `throwOnError()` in
[`binding.ts`](./src/core/functions/clients/binding.ts) and `handleResponse()`
in [`lib/api-client.ts`](./src/lib/api-client.ts) both re-raise the
data-service's `{ message, code }` body under the response status, so a failure
upstream keeps its identity instead of collapsing into "Request failed":

```typescript
const body = await response.json().catch(() => ({}));
const parsed = ErrorResponseSchema.safeParse(body);
const errorData = parsed.success ? parsed.data : {};
throw new AppError(
  errorData.message || "Request failed",
  errorData.code || "API_ERROR",
  response.status,
);
```

#### Rendering it

Which of the two shapes you use is decided by whether the error crossed a
server-function boundary, because the class does not survive that hop — the
message does, the `instanceof` check does not.

**Server functions** (`direct/*`, `binding/*`) — the error arrives client-side
as a plain `Error`, so read `.message` and do not narrow:

```tsx
{mutation.isError && (
  <Alert variant="destructive">
    <AlertDescription>{mutation.error.message}</AlertDescription>
  </Alert>
)}
```

**Browser fetch** (`api/*`, via `lib/api-client.ts`) — `AppError` is constructed
in the same context that renders it, so narrowing works and `status` is
available:

```tsx
{mutation.error instanceof AppError
  ? `${mutation.error.message} (${mutation.error.status})`
  : mutation.error.message}
```

That is why the `dashboard/api/*` routes narrow and the `dashboard/direct/*`
and `dashboard/binding/*` routes do not. Copy the one matching your access
pattern.

Nothing reads `field` yet. Both halves of field-level error display exist —
`direct.ts` sets it on `EMAIL_EXISTS`, and TanStack Form can attach a message to
a named input — but no route wires them together. If you want that, the data is
already there.

Validation is not handled here: `validator` parses with Zod before the
handler runs, and TanStack Form runs its own field validators in the browser
before anything is sent — see [Field Validators](#field-validators).

---

### Implementation Checklists

#### TanStack Form Checklist

- [ ] Ensure the Zod request schema exists in the domain's `schema.ts` in `@repo/data-ops`
- [ ] Create the server function the form submits to (see the checklist below)
- [ ] Wrap it in `useMutation`, invalidating the affected `clientKeys`-style query keys on success
- [ ] Create the form with `useForm({ defaultValues, onSubmit })`, calling `mutation.mutate(value)` from `onSubmit`
- [ ] Add field-level validators in `<form.Field>`
- [ ] Use `<form.Subscribe>` for submit button state
- [ ] Render `mutation.error.message` for server-side failures

#### Direct Server Functions Checklist

- [ ] Ensure the Zod schema exists in the domain's `schema.ts` in `@repo/data-ops`
- [ ] Import schemas and types from `@repo/data-ops/<domain>`
- [ ] Create the server function in `src/core/functions/`
- [ ] Leave auth to the global middleware; add to `PUBLIC_SERVER_FNS` only if anonymous callers need it
- [ ] Use `.validator()` with the imported Zod schema
- [ ] Translate failures into `AppError` in the handler
- [ ] Use TanStack Query (`useQuery`/`useMutation`) in UI
- [ ] Handle loading/error states in component

#### When to Use Which Approach

| Use Case | Approach |
|----------|----------|
| Create/Edit forms with multiple fields | TanStack Form + useMutation |
| Complex validation (async, cross-field) | TanStack Form validators + server-side Zod |
| Simple delete/toggle actions | Direct Server Function + useMutation |
| Data fetching | Direct Server Function + useQuery |
| Quick mutations from buttons | Direct Server Function + useMutation |

#### [`src/components/`](./src/components/)
React components organized by feature.

##### [`src/components/auth/`](./src/components/auth/)
Authentication UI components.

- **`account-dialog.tsx`** - User account management dialog
- **`email-auth.tsx`** - Email and password sign-in / sign-up form
- **`pending-approval.tsx`** - Shown to a signed-in account that is not yet approved


##### [`src/components/ui/`](./src/components/ui/)
Shadcn/UI base components (buttons, cards, dialogs, etc.).

**Theming:** Colors use oklch format (shadcn/ui standard). Custom status vars (`--success`, `--warning`, `--info`) are defined in `src/styles.css` alongside the standard shadcn palette. Use semantic theme classes (`text-destructive`, `bg-success/10`, `<Alert variant="success">`) instead of hardcoded Tailwind palette colors.

**tweakcn themes:** Install via `cd apps/user-application && pnpm dlx shadcn@latest add <tweakcn-url>`. Custom status vars survive theme installs (tweakcn merges, doesn't replace). Adjust status color values after theme swap to match new palette.

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
- **`api-client.ts`** - Browser client for the public data-service API (Pattern 3); authenticates with the session cookie only
- **`data-service.ts`** - `fetchDataService()`, a thin wrapper over the `DATA_SERVICE` service binding
- **`query-keys.ts`** - TanStack Query key factories and query options
- **`rate-limit.ts`** - Applies the shared rate-limit policy from `@repo/data-ops/rate-limit` around every request in `src/server.ts`
- **`security-headers.ts`** - Security headers applied in `src/server.ts`
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
  new Request("https://internal/clients")  // hostname ignored
);
```

**Benefits:**
- Faster (Cloudflare internal network, no public internet hop)
- More secure (`data-service` not publicly exposed)
- No CORS configuration needed
- No URL management per environment

#### Public API URL (Pattern 3)

The browser demo (`dashboard/api/*`, via [`lib/api-client.ts`](./src/lib/api-client.ts)) calls the data-service over the public internet at `VITE_DATA_SERVICE_URL`, a build-time Vite variable that falls back to `http://localhost:8788`. It sends the Better Auth session cookie (`credentials: "include"`) and no bearer token. The data-service already carries the CORS middleware this needs.

To use it outside local development:
1. Uncomment and set the custom-domain `routes` in `apps/data-service/wrangler.jsonc`
2. Set `VITE_DATA_SERVICE_URL` in the matching `.env.<mode>` file
3. Add this app's origin to the data-service's `ALLOWED_ORIGINS` for that environment (dev allows `localhost:3000` without it)

#### Comparison

| Aspect | Service Binding (`services`) | Public URL (`VITE_DATA_SERVICE_URL`) |
|--------|------------------------------|------------------|
| **Network** | Cloudflare internal | Public internet |
| **Speed** | Faster | Slower |
| **Security** | Private (not exposed) | Public endpoint, session-cookie auth |
| **Use case** | Server functions (Pattern 1) | Client direct calls (Pattern 3) |
| **Setup** | Just binding config | Custom domain + CORS origins |

#### Recommendation

**Use service bindings** (current setup) for all server-side operations. Expose the data-service publicly only when an external client needs it.

### Environment Variables

Config files in `apps/user-application/`:
- `.env` - Local development (not committed)
- `.env.staging` - Staging environment
- `.env.production` - Production environment

Sample `.env.example` file with minimum number of values available - [.env.example](./.env.example)

Variables the code reads:
- `CLOUDFLARE_ENV` - Current environment (dev/staging/production)
- `DATABASE_HOST` - PostgreSQL database host
- `DATABASE_USERNAME` - Database username
- `DATABASE_PASSWORD` - Database password
- `BETTER_AUTH_SECRET` - Authentication secret key
- `BETTER_AUTH_BASE_URL` - The app's base URL, passed to Better Auth as `baseURL`
- `DATA_SERVICE_API_TOKEN` - Bearer token for service-binding calls; must equal the data-service's `API_TOKEN`
- `VITE_DATA_SERVICE_URL` - Public data-service URL for the browser API client (defaults to `http://localhost:8788`)

The browser bundle carries no API token: the Pattern 3 client authenticates with the Better Auth session cookie, and `api-token-not-in-bundle.test.ts` fails if a `VITE_API_TOKEN` value ever reaches the bundle.

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
