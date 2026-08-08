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

> **Demo Routes:** See [docs/demos/](../../docs/demos/) for implementation examples of each pattern.

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

### TanStack Form (Complex Forms)

For forms with multiple fields and validation, use TanStack Form with FormData.

**Features:**
- Progressive enhancement (works without JavaScript)
- Native HTML form submission with FormData
- Server + client validation
- Type-safe form state management

**Required packages:**
```bash
pnpm add @tanstack/react-form @tanstack/react-form-start @tanstack/react-store
```

#### Form Setup Pattern

```typescript
// src/core/forms/create-user-form.ts
import { createServerFn } from "@tanstack/react-start";
import {
  formOptions,
  createServerValidate,
  ServerValidateError,
  getFormData,
} from "@tanstack/react-form-start";
import { UserCreateRequest, type UserCreateInput } from "@repo/data-ops/zod-schema/user";

// 1. Form options (shared between client/server)
export const createUserFormOpts = formOptions<UserCreateInput>({
  defaultValues: {
    name: "",
    email: "",
  },
});

// 2. Server-side validation
const serverValidate = createServerValidate({
  ...createUserFormOpts,
  onServerValidate: ({ value }) => {
    const result = UserCreateRequest.safeParse(value);
    if (!result.success) {
      return result.error.errors[0]?.message;
    }
  },
});

// 3. Server function handler
export const handleCreateUser = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Invalid form data");
    return data;
  })
  .handler(async (ctx) => {
    const validatedData = await serverValidate(ctx.data);
    // ... call API or database
  });

// 4. SSR form state
export const getCreateUserFormData = createServerFn({ method: "GET" }).handler(
  async () => getFormData()
);
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

For simple mutations (delete, toggle) use direct server functions with TanStack Query.

```typescript
// src/core/functions/user-functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

const protectedFunction = createServerFn().middleware([
  protectedFunctionMiddleware,
]);

export const deleteClient = protectedFunction
  .validator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const response = await env.DATA_SERVICE.fetch(
      new Request(`https://data-service/clients/${data.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${env.DATA_SERVICE_API_TOKEN}` },
      })
    );
    if (!response.ok) throw new Error("Failed to delete");
    return { success: true };
  });
```

#### With TanStack Query

```typescript
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteClient({ data: { id } }),
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

Schemas are defined in `packages/data-ops/src/zod-schema/` and shared across apps.

#### Schema Types

```typescript
// packages/data-ops/src/zod-schema/user.ts
import { z } from "zod";

// Domain Schema (what data looks like)
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
});

// Request Schemas (what client sends)
export const UserCreateRequest = z.object({
  name: z.string().min(1).max(30),
  email: z.string().email()
});

export const UserUpdateRequest = z.object({
  name: z.string().min(1).max(30).optional(),
  email: z.string().email().optional()
}).refine(data => data.name || data.email, {
  message: "At least one field required"
});

// Pagination Schemas
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0)
});

// Inferred Types
export type User = z.infer<typeof UserSchema>;
export type UserCreateInput = z.infer<typeof UserCreateRequest>;
export type UserUpdateInput = z.infer<typeof UserUpdateRequest>;
```

#### Using in Server Functions

```typescript
import { UserCreateRequest, type UserCreateInput } from "@repo/data-ops/zod-schema/user";

export const createUser = createServerFn()
  .validator((data: UserCreateInput) => UserCreateRequest.parse(data))
  .handler(async ({ data }) => {
    // data is typed and validated
  });
```

---

### Middleware Patterns

#### Authentication Middleware

```typescript
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

const protectedFunction = createServerFn().middleware([
  protectedFunctionMiddleware,
]);

export const myProtectedFunction = protectedFunction
  .validator(/* ... */)
  .handler(async ({ data, context }) => {
    // context.session is available with user data
    const { session } = context;
    console.log("Authenticated user:", session.user.id);
  });
```

#### Custom Context Middleware

```typescript
// src/core/middleware/request-context.ts
import { createMiddleware } from "@tanstack/react-start";

export const requestContextMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  return await next({
    context: { requestId, timestamp },
  });
});
```

#### Combining Multiple Middleware

```typescript
const fullyProtectedFunction = createServerFn().middleware([
  requestContextMiddleware,  // Runs first
  protectedFunctionMiddleware,  // Runs second
]);

export const auditedAction = fullyProtectedFunction
  .validator(/* ... */)
  .handler(async ({ data, context }) => {
    // context has: requestId, timestamp, session
    console.log(`[${context.requestId}] User ${context.session.user.id}`);
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

Validation is not handled here: `inputValidator` parses with Zod before the
handler runs, and TanStack Form surfaces field errors from the same schemas —
see [Field Validators](#field-validators).

---

### Implementation Checklists

#### TanStack Form Checklist

- [ ] Install `@tanstack/react-form`, `@tanstack/react-form-start`, `@tanstack/react-store`
- [ ] Ensure Zod schema exists in `packages/data-ops/src/zod-schema/`
- [ ] Create form options in `src/core/forms/` (imports schema from `@repo/data-ops`)
- [ ] Create `createServerValidate` for server validation
- [ ] Create server function with FormData input validator
- [ ] Create `getFormData` server function for SSR
- [ ] Use `useForm` with `useTransform` + `mergeForm` in component
- [ ] Use native `<form>` with `action`, `method="post"`, `encType="multipart/form-data"`
- [ ] Add field-level validators in `<form.Field>`
- [ ] Use `<form.Subscribe>` for submit button state

#### Direct Server Functions Checklist

- [ ] Ensure Zod schema exists in `packages/data-ops/src/zod-schema/`
- [ ] Import schemas and types from `@repo/data-ops/zod-schema/...`
- [ ] Create server function in `src/core/functions/`
- [ ] Add appropriate middleware (auth if needed)
- [ ] Use `.validator()` with imported Zod schema
- [ ] Handle errors appropriately in handler
- [ ] Use TanStack Query (`useQuery`/`useMutation`) in UI
- [ ] Handle loading/error states in component

#### When to Use Which Approach

| Use Case | Approach |
|----------|----------|
| Create/Edit forms with multiple fields | TanStack Form + FormData |
| Forms that should work without JS | TanStack Form + FormData |
| Complex validation (async, cross-field) | TanStack Form + FormData |
| Simple delete/toggle actions | Direct Server Function + useMutation |
| Data fetching | Direct Server Function + useQuery |
| Quick mutations from buttons | Direct Server Function + useMutation |

#### [`src/components/`](./src/components/)
React components organized by feature.

##### [`src/components/auth/`](./src/components/auth/)
Authentication UI components.

- **`account-dialog.tsx`** - User account management dialog
- **`google-login.tsx`** - Google OAuth login button


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
