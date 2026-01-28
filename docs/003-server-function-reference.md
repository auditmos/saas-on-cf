# Server Function Reference Guide

## Overview

TanStack Start server functions for the user-application. This document covers two approaches:

1. **TanStack Form + FormData** (recommended for forms) - Uses `@tanstack/react-form-start` with native HTML forms
2. **Direct Server Functions** (for simple mutations/queries) - Uses `createServerFn` with JSON data

## Goals

- Type-safe server functions with Zod validation
- Progressive enhancement (forms work without JavaScript)
- Reusable middleware patterns (auth, context injection)
- Clean UI integration with loading/error states

## Dependencies

Add to `apps/user-application/package.json`:

```bash
pnpm add @tanstack/react-form @tanstack/react-form-start @tanstack/react-store
```

## Architecture

### Schema Location: `data-ops` Package (Shared)

Zod schemas live in `packages/data-ops/src/zod-schema/` to be shared between `user-application` and `data-service`:

```
packages/data-ops/src/
├── zod-schema/
│   ├── user.ts              # User domain schemas (existing)
│   ├── responses/
│   │   └── health.ts        # Response schemas (existing)
│   └── common.ts            # Shared schemas (pagination, etc.)
├── queries/
│   └── user.ts              # Database queries
└── mocks/
    └── user-mock.ts         # Mock data for testing
```

### Application Code: `user-application`

Form definitions and server functions live in the application:

```
apps/user-application/src/core/
├── forms/
│   ├── create-user-form.ts  # Form options + server validation
│   └── update-user-form.ts  # Uses schemas from @repo/data-ops
├── functions/
│   ├── example-functions.ts # Basic example
│   └── user-functions.ts    # Direct server functions
└── middleware/
    ├── auth.ts              # Authentication middleware
    └── example-middleware.ts# Context injection example
```

### Import Pattern

```typescript
// In user-application, import schemas from data-ops
import {
  UserSchema,
  UserCreateRequest,
  type User,
  type UserCreateInput,
} from "@repo/data-ops/zod-schema/user";
```

---

## Data Access Patterns

There are **three approaches** for accessing data from `user-application`. Each has trade-offs - choose based on your use case.

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                               │
└───────────────────┬─────────────────────────────────┬───────────────────────┘
                    │                                 │
                    │ Approach 1 & 2                  │ Approach 3
                    │ (Server Functions)              │ (Direct API)
                    ▼                                 │
┌─────────────────────────────────────────────┐      │
│            user-application                  │      │
│            (TanStack Start)                  │      │
│                                              │      │
│  ┌────────────────┐    ┌────────────────┐   │      │
│  │ Approach 1     │    │ Approach 2     │   │      │
│  │ Server Fn →    │    │ Server Fn →    │   │      │
│  │ data-service   │    │ data-ops       │   │      │
│  └───────┬────────┘    └───────┬────────┘   │      │
│          │                     │            │      │
└──────────┼─────────────────────┼────────────┘      │
           │ Service Binding     │ Direct            │
           ▼                     │                   ▼
┌──────────────────────┐         │         ┌──────────────────────┐
│    data-service      │         │         │    data-service      │
│    (Hono API)        │         │         │    (Public API)      │
│                      │         │         │                      │
│  • GET /users        │         │         │  Requires:           │
│  • POST /users       │         │         │  • Public routes     │
│  • PUT /users/:id    │         │         │  • CORS config       │
│  • DELETE /users/:id │         │         │  • Client auth       │
└──────────┬───────────┘         │         └──────────┬───────────┘
           │                     │                    │
           └──────────┬──────────┘                    │
                      ▼                               │
           ┌──────────────────────┐                   │
           │     data-ops         │◀──────────────────┘
           │  (shared package)    │
           │                      │
           │  • Zod schemas       │
           │  • DB queries        │
           │  • Mocks             │
           └──────────┬───────────┘
                      │
                      ▼
               ┌────────────┐
               │  Database  │
               └────────────┘
```

### Pattern Comparison

| Aspect | 1. Server Fn → data-service | 2. Server Fn → data-ops | 3. Client → data-service |
|--------|----------------------------|------------------------|-------------------------|
| **Data flow** | Browser → Server Fn → Binding → API | Browser → Server Fn → DB | Browser → Public API |
| **Latency** | Higher (2 hops) | Lower (1 hop) | Medium (1 public hop) |
| **Auth method** | Server session (Better Auth) | Server session | Client tokens |
| **Security** | Internal binding (private) | Internal (private) | Public endpoint |
| **SSR support** | Yes | Yes | No (client-only) |
| **Reuses data-service logic** | Yes | No | Yes |
| **Good for** | CRUD with business rules | Auth, perf-critical queries | Mobile apps, SPAs |

### When to Use Each Pattern

#### Approach 1: Server Function → data-service (via binding)

**Use when:**
- Operation has business logic that should be centralized
- Same endpoint is/will be used by external clients (mobile, third-party)
- data-service already has the endpoint with validation/rate-limiting
- You want single source of truth for data operations

**Example use cases:**
- User CRUD operations
- Payment processing
- Any operation that external APIs also need

#### Approach 2: Server Function → data-ops (direct)

**Use when:**
- Performance is critical (no extra hop)
- Operation is user-application specific (not needed elsewhere)
- Complex transactions spanning multiple tables
- Auth/session operations (already established pattern)
- Simple read queries with no business logic

**Example use cases:**
- Session/auth checks (Better Auth already does this)
- Dashboard aggregations specific to the frontend
- Complex joins that would require multiple API calls
- Transactions with rollback requirements

#### Approach 3: Client → data-service (direct HTTP)

**Use when:**
- Building SPA with minimal SSR needs
- Mobile app needs the same API
- Real-time features (WebSocket/SSE from data-service)
- Public read-only endpoints
- You want user-application to be purely UI

**Example use cases:**
- Mobile app consuming same API
- Public product listings
- Real-time notifications
- Third-party integrations

**Requires additional setup:**
- Public routes in `data-service/wrangler.jsonc`
- CORS middleware in data-service
- Client-side auth token management

---

### Pattern 1: Server Function → data-service (Implementation)

**Service binding configuration** (`wrangler.jsonc`):

```jsonc
{
  "services": [
    {
      "binding": "DATA_SERVICE",
      "service": "saas-on-cf-ds-dev"  // or staging/production
    }
  ]
}
```

**Calling the service binding**:

```typescript
import { env } from "cloudflare:workers";

// The hostname is ignored - request goes to bound worker
const response = await env.DATA_SERVICE.fetch(
  new Request("https://data-service/users")
);
```

> **Note:** Per [Cloudflare documentation](https://developers.cloudflare.com/workers/configuration/environment-variables/#import-env-for-global-access),
> importing `env` from `cloudflare:workers` at the top level is the recommended approach.
> This allows access to bindings from anywhere in your code without passing `env` through function calls.

---

### Pattern 2: Server Function → data-ops (Implementation)

**Direct database access:**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getUsers, getUserById } from "@repo/data-ops/queries/user";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

// Direct data-ops query (no data-service hop)
export const listUsersDirectly = createServerFn()
  .middleware([protectedFunctionMiddleware])
  .handler(async ({ context }) => {
    // Direct database query - faster, but logic not shared with data-service
    const users = await getUsers({ limit: 10, offset: 0 });
    return users;
  });
```

**When to choose this:**
```typescript
// Auth operations - already use data-ops directly
import { getSession } from "@repo/data-ops/auth/server";

export const getCurrentUser = createServerFn()
  .handler(async () => {
    const session = await getSession();  // Direct, no API call
    return session?.user ?? null;
  });
```

---

### Pattern 3: Client → data-service (Implementation)

**Requires data-service setup:**

```typescript
// data-service: Add CORS middleware
import { cors } from 'hono/cors';

app.use('/api/*', cors({
  origin: ['https://your-app.com'],
  credentials: true,
}));
```

**Client-side usage:**

```typescript
// In user-application client code
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const response = await fetch('https://api.your-app.com/users', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.json();
  },
});
```

---

### Recommended Pattern by Operation Type

| Operation | Recommended Pattern | Rationale |
|-----------|-------------------|-----------|
| Auth/session checks | **2. Direct data-ops** | Performance critical, already established |
| User CRUD | **1. Via data-service** | Centralized business logic |
| Admin operations | **1. Via data-service** | Needs rate limiting, audit logging |
| Dashboard queries | **2. Direct data-ops** | Frontend-specific, performance |
| Public listings | **3. Client direct** | No auth needed, cacheable |
| Mobile app API | **3. Client direct** | Separate client, same API |
| Real-time features | **3. Client direct** | WebSocket/SSE support |
| Complex transactions | **2. Direct data-ops** | Single connection, rollback |

---

# Part 1: TanStack Form + FormData (Recommended for Forms)

This is the official TanStack-recommended approach for handling forms in TanStack Start. It provides:
- Progressive enhancement (works without JavaScript)
- Native HTML form submission with FormData
- Server + client validation
- Type-safe form state management

## Form Setup

### Step 1: Define Form Options (Isomorphic)

Create shared form configuration that works on both client and server.

```typescript
// src/core/forms/create-user-form.ts
import { formOptions } from "@tanstack/react-form-start";

export const createUserFormOpts = formOptions({
  defaultValues: {
    name: "",
    email: "",
    role: "user" as "admin" | "user" | "viewer",
  },
});
```

### Step 2: Create Server Validation + Handler

```typescript
// src/core/forms/create-user-form.ts
import { createServerFn } from "@tanstack/react-start";
import {
  formOptions,
  createServerValidate,
  ServerValidateError,
  getFormData,
} from "@tanstack/react-form-start";
import { env } from "cloudflare:workers";
// Import schemas from shared data-ops package
import { UserCreateRequest, type UserCreateInput } from "@repo/data-ops/zod-schema/user";

// Form options (shared between client/server)
// defaultValues match the schema structure
export const createUserFormOpts = formOptions<UserCreateInput>({
  defaultValues: {
    name: "",
    email: "",
  },
});

// Server-side validation (uses Zod schema from data-ops)
const serverValidate = createServerValidate({
  ...createUserFormOpts,
  onServerValidate: ({ value }) => {
    // First, validate with Zod schema (same validation as data-service API)
    const result = UserCreateRequest.safeParse(value);
    if (!result.success) {
      return result.error.errors[0]?.message;
    }
    
    // Additional server-only validation (e.g., check if email exists in DB)
    if (value.email.endsWith("@blocked.com")) {
      return "This email domain is not allowed";
    }
  },
});

// Server function to handle form submission
export const handleCreateUser = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Invalid form data");
    }
    return data;
  })
  .handler(async (ctx) => {
    try {
      const validatedData = await serverValidate(ctx.data);
      
      // Call data-service API via service binding
      const response = await env.DATA_SERVICE.fetch(
        new Request("https://data-service/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
          },
          body: JSON.stringify(validatedData),
        })
      );
      
      if (!response.ok) {
        const error = await response.json() as { message?: string };
        throw new Error(error.message || "Failed to create user");
      }
      
      return "User created successfully";
    } catch (e) {
      if (e instanceof ServerValidateError) {
        // Return validation errors to client
        return e.response;
      }
      console.error(e);
      throw new Error("Failed to create user");
    }
  });

// Server function to get form state (for SSR)
export const getCreateUserFormData = createServerFn({ method: "GET" }).handler(
  async () => {
    return getFormData();
  }
);
```

### Step 3: Create the Form Component

```tsx
// src/routes/_auth/app/users/new.tsx
import { createFileRoute } from "@tanstack/react-router";
import {
  mergeForm,
  useForm,
  useTransform,
} from "@tanstack/react-form-start";
import { useStore } from "@tanstack/react-store";
import {
  createUserFormOpts,
  handleCreateUser,
  getCreateUserFormData,
} from "@/core/forms/create-user-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_auth/app/users/new")({
  component: CreateUserPage,
  loader: async () => ({
    formState: await getCreateUserFormData(),
  }),
});

function CreateUserPage() {
  const { formState } = Route.useLoaderData();

  const form = useForm({
    ...createUserFormOpts,
    // Merge server state with client state (for SSR + validation errors)
    transform: useTransform(
      (baseForm) => mergeForm(baseForm, formState),
      [formState]
    ),
  });

  // Subscribe to form-level errors
  const formErrors = useStore(form.store, (state) => state.errors);

  return (
    <form
      action={handleCreateUser.url}
      method="post"
      encType="multipart/form-data"
    >
      <h1>Create User</h1>

      {/* Form-level errors */}
      {formErrors.map((error) => (
        <p key={error as string} className="text-red-500">
          {error}
        </p>
      ))}

      {/* Name Field */}
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            value.length < 2 ? "Name must be at least 2 characters" : undefined,
          onBlur: ({ value }) =>
            value.length > 50 ? "Name is too long" : undefined,
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor={field.name}>Name</label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error as string} className="text-red-500 text-sm">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      {/* Email Field */}
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            if (!value) return "Email is required";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              return "Invalid email format";
            }
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <label htmlFor={field.name}>Email</label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error as string} className="text-red-500 text-sm">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      {/* Submit Button */}
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : "Create User"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

## TanStack Form Key Concepts

### Field Validators

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

### Form-Level Validation

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

### Subscribing to Form State

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

# Part 2: Direct Server Functions (For Mutations/Queries)

For simple server calls that don't need full form handling (e.g., delete actions, data fetching, quick mutations), use direct server functions.

## Zod Schema Patterns

### Location: `data-ops` Package

Schemas are defined in `packages/data-ops/src/zod-schema/` and shared across apps.

### Existing Schemas (`packages/data-ops/src/zod-schema/user.ts`)

```typescript
import { z } from "zod";

// Domain Schema
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
});

// Request Schemas
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

export const PaginationMetaSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean()
});

// Response Schemas
export const UserResponse = UserSchema;

export const UserListResponse = z.object({
  data: z.array(UserSchema),
  pagination: PaginationMetaSchema
});

// Inferred Types (exported for use in both apps)
export type User = z.infer<typeof UserSchema>;
export type UserCreateInput = z.infer<typeof UserCreateRequest>;
export type UserUpdateInput = z.infer<typeof UserUpdateRequest>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type UserListResponseData = z.infer<typeof UserListResponse>;
```

### Adding New Schemas

When you need new schemas, add them to `data-ops`:

```typescript
// packages/data-ops/src/zod-schema/user.ts (extend existing)
export const UserDeleteRequest = z.object({
  id: z.string().uuid(),
});

export type UserDeleteInput = z.infer<typeof UserDeleteRequest>;
```

## Server Function Patterns

### Basic Function (`functions/user-functions.ts`)

Server functions in `user-application` call the `data-service` API via the **`DATA_SERVICE` service binding**.

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
// Import schemas and types from shared data-ops package
import {
  UserCreateRequest,
  PaginationQuerySchema,
  type User,
  type UserCreateInput,
  type PaginationQuery,
  type UserListResponseData,
} from "@repo/data-ops/zod-schema/user";

// Base function with auth middleware
const protectedFunction = createServerFn().middleware([
  protectedFunctionMiddleware,
]);

// Public function (no auth required)
const publicFunction = createServerFn();

// Simple ID schema for get/delete operations
const IdInput = z.object({ id: z.string() });
type IdInputType = z.infer<typeof IdInput>;

/**
 * Get user by ID (public)
 * Calls: GET /users/:id on data-service
 */
export const getUser = publicFunction
  .inputValidator((data: IdInputType) => IdInput.parse(data))
  .handler(async ({ data }) => {
    // Call data-service via service binding
    const response = await env.DATA_SERVICE.fetch(
      new Request(`https://data-service/users/${data.id}`)
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("User not found");
      }
      throw new Error("Failed to fetch user");
    }
    
    return response.json() as Promise<User>;
  });

/**
 * List users with pagination (public)
 * Calls: GET /users on data-service
 */
export const listUsers = publicFunction
  .inputValidator((data: PaginationQuery) => PaginationQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const { limit, offset } = data;
    
    // Build query string
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    
    // Call data-service via service binding
    const response = await env.DATA_SERVICE.fetch(
      new Request(`https://data-service/users?${params}`)
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }
    
    return response.json() as Promise<UserListResponseData>;
  });

/**
 * Create user (protected - requires auth)
 * Calls: POST /users on data-service
 */
export const createUser = protectedFunction
  .inputValidator((data: UserCreateInput) => UserCreateRequest.parse(data))
  .handler(async ({ data, context }) => {
    const { session } = context;
    
    console.log(`User ${session.user.id} creating new user`);
    
    // Call data-service via service binding
    const response = await env.DATA_SERVICE.fetch(
      new Request("https://data-service/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
        },
        body: JSON.stringify(data),
      })
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create user");
    }
    
    return response.json() as Promise<User>;
  });
```

> **Architecture Note:** The `DATA_SERVICE` binding is defined in `wrangler.jsonc` and connects
> `user-application` to `data-service`. The hostname in the URL (e.g., `https://data-service/`)
> is ignored - requests go directly to the bound worker via Cloudflare's internal network.

### Function with Custom Error Handling

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

// Custom error class for typed errors
class ServerFunctionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ServerFunctionError";
  }
}

const DeleteUserInputSchema = z.object({
  id: z.string(),
});

type DeleteUserInput = z.infer<typeof DeleteUserInputSchema>;

/**
 * Delete user (protected - requires admin)
 * Calls: DELETE /users/:id on data-service
 */
export const deleteUser = createServerFn()
  .middleware([protectedFunctionMiddleware])
  .inputValidator((data: DeleteUserInput) => DeleteUserInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { session } = context;
    
    // Check permissions (app-level authorization)
    if (session.user.role !== "admin") {
      throw new ServerFunctionError(
        "Only admins can delete users",
        "FORBIDDEN",
        403
      );
    }
    
    // Prevent self-deletion
    if (data.id === session.user.id) {
      throw new ServerFunctionError(
        "Cannot delete your own account",
        "SELF_DELETE_FORBIDDEN",
        400
      );
    }
    
    // Call data-service via service binding
    const response = await env.DATA_SERVICE.fetch(
      new Request(`https://data-service/users/${data.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${env.DATA_SERVICE_API_TOKEN}`,
        },
      })
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new ServerFunctionError("User not found", "NOT_FOUND", 404);
      }
      throw new ServerFunctionError("Failed to delete user", "DELETE_FAILED", 500);
    }
    
    return { success: true };
  });
```

## Calling Direct Server Functions from UI

Use direct server function calls for simple mutations that don't need form handling.

### Basic Usage (Simple Mutation)

```tsx
// src/routes/_auth/app/users/index.tsx
import { useState } from "react";
import { getUser, listUsers, createUser } from "@/core/functions/user-functions";

export function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await listUsers({ data: { limit: 10, offset: 0 } });
      setUsers(result.users);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  // Render component...
}
```

### With TanStack Query (Recommended)

```tsx
// src/routes/_auth/app/users/index.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, createUser, deleteUser } from "@/core/functions/user-functions";
import type { CreateUserInput } from "@/core/schemas/user-schemas";

// Query keys factory
const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: { limit: number; offset: number }) => 
    [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export function UserManagement() {
  const queryClient = useQueryClient();

  // Fetch users
  const { 
    data, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: userKeys.list({ limit: 10, offset: 0 }),
    queryFn: () => listUsers({ data: { limit: 10, offset: 0 } }),
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => createUser({ data: input }),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    onError: (error) => {
      console.error("Failed to create user:", error.message);
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });

  const handleCreateUser = async (formData: CreateUserInput) => {
    await createMutation.mutateAsync(formData);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Users</h1>
      
      {/* Create form */}
      <CreateUserForm 
        onSubmit={handleCreateUser}
        isLoading={createMutation.isPending}
        error={createMutation.error?.message}
      />
      
      {/* User list */}
      <ul>
        {data?.users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
            <button 
              onClick={() => deleteMutation.mutate(user.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      
      {/* Pagination */}
      {data?.pagination.hasMore && (
        <button onClick={() => refetch()}>Load More</button>
      )}
    </div>
  );
}
```

### Form Integration

> **Note:** For forms with multiple fields and validation, use **TanStack Form** (see Part 1).
> The example below shows a simple mutation triggered by a button, not a full form.

```tsx
// Example: Delete button with confirmation
function DeleteUserButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return (
    <button
      onClick={() => {
        if (confirm("Delete this user?")) {
          deleteMutation.mutate(userId);
        }
      }}
      disabled={deleteMutation.isPending}
    >
      {deleteMutation.isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
```

## Middleware Patterns

### Authentication Middleware

Use `protectedFunctionMiddleware` from `@/core/middleware/auth.ts` for functions requiring authentication:

```typescript
import { protectedFunctionMiddleware } from "@/core/middleware/auth";

const protectedFunction = createServerFn().middleware([
  protectedFunctionMiddleware,
]);

export const myProtectedFunction = protectedFunction
  .inputValidator(/* ... */)
  .handler(async ({ data, context }) => {
    // context.session is available with user data
    const { session } = context;
    console.log("Authenticated user:", session.user.id);
  });
```

### Custom Context Middleware

```typescript
// src/core/middleware/request-context.ts
import { createMiddleware } from "@tanstack/react-start";

export const requestContextMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  return await next({
    context: {
      requestId,
      timestamp,
    },
  });
});
```

### Combining Multiple Middleware

```typescript
import { protectedFunctionMiddleware } from "@/core/middleware/auth";
import { requestContextMiddleware } from "@/core/middleware/request-context";

const fullyProtectedFunction = createServerFn().middleware([
  requestContextMiddleware,  // Runs first
  protectedFunctionMiddleware,  // Runs second
]);

export const auditedAction = fullyProtectedFunction
  .inputValidator(/* ... */)
  .handler(async ({ data, context }) => {
    // context has: requestId, timestamp, session
    console.log(`[${context.requestId}] User ${context.session.user.id} at ${context.timestamp}`);
  });
```

## Error Handling Best Practices

### 1. Use Zod for Input Validation

Zod errors are automatically thrown with descriptive messages:

```typescript
// This will throw ZodError with message like:
// "Invalid email format" or "Name is required"
.inputValidator((data) => MySchema.parse(data))
```

### 2. Create Domain-Specific Errors

```typescript
// src/core/errors/index.ts
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
```

### 3. Handle Errors in UI

```tsx
import { ZodError } from "zod";
import { NotFoundError, ForbiddenError } from "@/core/errors";

const handleError = (error: unknown) => {
  if (error instanceof ZodError) {
    // Validation error - show field-specific messages
    return error.errors.map(e => e.message).join(", ");
  }
  
  if (error instanceof NotFoundError) {
    return "The requested item was not found";
  }
  
  if (error instanceof ForbiddenError) {
    return "You don't have permission to do this";
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return "An unexpected error occurred";
};
```

## File Structure Summary

```
packages/data-ops/src/
├── zod-schema/                     # SHARED SCHEMAS (used by both apps)
│   ├── user.ts                     # User domain + request schemas
│   ├── common.ts                   # Pagination, ID schemas
│   └── responses/
│       └── health.ts               # Health check response
├── queries/
│   └── user.ts                     # Database queries
└── mocks/
    └── user-mock.ts                # Mock data for development

apps/user-application/src/
├── core/
│   ├── errors/
│   │   └── index.ts                # Domain error classes
│   ├── forms/                      # TanStack Form definitions
│   │   ├── create-user-form.ts     # Form opts + server validation
│   │   └── update-user-form.ts     # Imports schemas from @repo/data-ops
│   ├── functions/                  # Direct server functions
│   │   ├── example-functions.ts    # Basic example
│   │   └── user-functions.ts       # Imports schemas from @repo/data-ops
│   └── middleware/
│       ├── auth.ts                 # Auth middleware
│       └── example-middleware.ts   # Context example
├── components/
│   └── users/
│       └── user-list.tsx           # Component using TanStack Query
└── routes/
    └── _auth/
        └── app/
            └── users/
                ├── index.tsx       # List page
                └── new.tsx         # Create page (TanStack Form)
```

---

## When to Use Which Approach

| Use Case | Approach |
|----------|----------|
| Create/Edit forms with multiple fields | TanStack Form + FormData |
| Forms that should work without JS | TanStack Form + FormData |
| Complex validation (async, cross-field) | TanStack Form + FormData |
| Simple delete/toggle actions | Direct Server Function + useMutation |
| Data fetching | Direct Server Function + useQuery |
| Quick mutations from buttons | Direct Server Function + useMutation |

## Checklist for TanStack Form

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

## Checklist for Direct Server Functions

- [ ] Ensure Zod schema exists in `packages/data-ops/src/zod-schema/`
- [ ] Import schemas and types from `@repo/data-ops/zod-schema/...`
- [ ] Create server function in `src/core/functions/`
- [ ] Add appropriate middleware (auth if needed)
- [ ] Use `.inputValidator()` with imported Zod schema
- [ ] Handle errors appropriately in handler
- [ ] Use TanStack Query (`useQuery`/`useMutation`) in UI
- [ ] Handle loading/error states in component
