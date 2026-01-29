# Demo Routes - Architecture Overview

## Purpose

This demo system provides reference implementations for the different data flow patterns available in the saas-on-cf architecture. Each demo route showcases a specific communication pattern between `user-application`, `data-service`, and `data-ops`, helping developers understand when and how to use each approach.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                                    │
└─────────────┬───────────────────────┬───────────────────────┬───────────────────┘
              │                       │                       │
              │ Pattern A             │ Pattern B & C         │ Pattern D
              │ (Client Direct)       │ (Server Functions)    │ (Forms)
              │                       │                       │
              ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           user-application (TanStack Start)                      │
│                                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────────┐ │
│  │ Pattern A        │   │ Pattern B        │   │ Pattern C & D                │ │
│  │ Client fetch()   │   │ Server Fn →      │   │ Server Fn →                  │ │
│  │ to public API    │   │ DATA_SERVICE     │   │ data-ops (direct DB)         │ │
│  │                  │   │ binding          │   │                              │ │
│  └──────────────────┘   └────────┬─────────┘   └──────────────┬───────────────┘ │
│                                  │                            │                  │
└──────────────────────────────────┼────────────────────────────┼──────────────────┘
                                   │                            │
                                   │ Service Binding            │ Direct Import
                                   │ (Internal Network)         │
                                   ▼                            │
┌──────────────────────────────────────────────────┐            │
│              data-service (Hono API)             │            │
│                                                  │            │
│  • GET  /users      (list, paginated)           │            │
│  • GET  /users/:id  (single user)               │            │
│  • POST /users      (create, auth required)     │            │
│  • PUT  /users/:id  (update, auth required)     │            │
│  • DELETE /users/:id (delete, auth required)    │            │
│                                                  │            │
└──────────────────┬───────────────────────────────┘            │
                   │                                            │
                   └────────────────────┬───────────────────────┘
                                        │
                                        ▼
                           ┌──────────────────────┐
                           │     data-ops         │
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
                               │    (D1)    │
                               └────────────┘
```

## Demo Routes Structure

```
/demo
├── /                           → Overview & navigation
├── /users-list-api             → GET /users (Client → data-service)
├── /user-detail-direct         → GET /users/:id (Server Fn → data-ops)
├── /user-create-binding        → POST /users (Server Fn → data-service binding)
├── /user-update-direct         → PUT /users (Server Fn → data-ops)
└── /user-delete-direct         → DELETE /users (Server Fn → data-ops)
```

## Pattern Comparison

| Demo Route | Pattern | Data Flow | SSR | Auth Location | Latency |
|------------|---------|-----------|-----|---------------|---------|
| `/demo/users-list-api` | Client → API | Browser → data-service | ❌ | Client token | Medium |
| `/demo/user-detail-direct` | Server → data-ops | Browser → Server Fn → DB | ✅ | Server session | Low |
| `/demo/user-create-binding` | Server → Binding | Browser → Server Fn → data-service | ✅ | Server session | Higher |
| `/demo/user-update-direct` | Server → data-ops | Browser → Server Fn → DB | ✅ | Server session | Low |
| `/demo/user-delete-direct` | Server → data-ops | Browser → Server Fn → DB | ✅ | Server session | Low |

## When to Use Each Pattern

### Pattern A: Client → data-service (Direct API)
**Best for:**
- Public read-only data
- Mobile app compatibility (same API)
- Real-time features (WebSocket/SSE)
- Minimal SSR requirements

**Example:** Product listings, public user profiles, search results

### Pattern B: Server Function → data-service (via Binding)
**Best for:**
- CRUD operations with centralized business logic
- Operations that external clients also need
- When data-service has rate limiting/validation

**Example:** User creation, payment processing, admin operations

### Pattern C & D: Server Function → data-ops (Direct)
**Best for:**
- Performance-critical operations
- App-specific queries (not needed elsewhere)
- Complex transactions with rollback
- Auth/session operations

**Example:** Dashboard aggregations, user preferences, session management

## Prerequisites for All Demos

### 1. Dependencies (user-application)

```bash
# Already installed
pnpm add @tanstack/react-query @tanstack/react-form @tanstack/react-form-start

# If not installed
pnpm add @tanstack/react-store
```

### 2. Service Binding (already configured)

`apps/user-application/wrangler.jsonc`:
```jsonc
"services": [
  {
    "binding": "DATA_SERVICE",
    "service": "saas-on-cf-ds-dev"
  }
]
```

### 3. Mock-Based Queries (for direct patterns)

The demos use mocks from `data-ops` that mirror the future database interface.
See [002 - Prerequisites Setup](./002-prerequisites-setup.md) for details.

```typescript
// data-ops/src/queries/user.ts uses mockUsers internally
// Same interface will work with Neon database later
import { getUser, getUsers, updateUser, deleteUser } from '@repo/data-ops/queries/user';
```

### 4. CORS Middleware (for client direct pattern)

See [003 - CORS Configuration](./003-cors-configuration.md) for full implementation.

```typescript
// data-service/src/hono/app.ts
import { createCorsMiddleware } from './middleware/cors';
App.use('*', createCorsMiddleware());
```

### 5. Environment Tokens

```env
# data-service/.dev.vars
API_TOKEN=demo-api-token-12345

# user-application/.env.local
DATA_SERVICE_API_TOKEN=demo-api-token-12345
VITE_DATA_SERVICE_URL=http://localhost:8787
```

## Implementation Checklist

### Phase 1: Prerequisites
- [ ] Create `.dev.vars` / `.env.local` with sample tokens
- [ ] Implement CORS middleware in data-service
- [ ] Update type definitions (Env interfaces)
- [ ] Create mock-based query interface in data-ops

### Phase 2: Demo Routes
- [ ] Create `/demo` route layout with navigation
- [ ] Implement GET /users demo (client → API)
- [ ] Implement GET /users/:id demo (server → mock)
- [ ] Implement POST /users demo (server → binding)
- [ ] Implement PUT /users demo (server → mock)
- [ ] Implement DELETE /users demo (server → mock)

### Phase 3: Future Migration
- [ ] Add Neon database connection
- [ ] Replace mock queries with Drizzle queries
- [ ] Same interface, different implementation

## Related Documents

### Prerequisites (implement first)
- [002 - Prerequisites Setup](./002-prerequisites-setup.md) - Environment, tokens, mocks
- [003 - CORS Configuration](./003-cors-configuration.md) - CORS middleware setup

### Demo Routes (implement in order)
- [004 - GET Users (Client → API)](./004-get-users-client-api.md)
- [005 - GET User (Server → data-ops)](./005-get-user-direct-dataops.md)
- [006 - POST User (Server → Binding)](./006-post-user-service-binding.md)
- [007 - PUT User (Server → data-ops)](./007-put-user-direct-dataops.md)
- [008 - DELETE User (Server → data-ops)](./008-delete-user-direct-dataops.md)
