# CORS Configuration for data-service

## Overview

This document describes how to configure Cross-Origin Resource Sharing (CORS) in `data-service` using Hono's built-in CORS middleware. CORS is required for **Pattern A** (Client → data-service direct) where the browser makes direct fetch requests to the API.

## When CORS is Needed

| Scenario | CORS Required |
|----------|---------------|
| Browser → data-service (Pattern A) | ✅ Yes |
| Server Function → DATA_SERVICE binding | ❌ No (internal network) |
| Server Function → data-ops direct | ❌ No (same process) |
| Mobile app → data-service | ❌ No (not browser) |

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                     │
│  Origin: http://localhost:5173                                       │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         │ 1. fetch('http://localhost:8787/users')
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PREFLIGHT (OPTIONS)                               │
│                                                                      │
│  Browser automatically sends OPTIONS request:                        │
│  - Origin: http://localhost:5173                                     │
│  - Access-Control-Request-Method: GET                                │
│  - Access-Control-Request-Headers: Content-Type, Authorization       │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    data-service (Hono)                               │
│                                                                      │
│  CORS Middleware checks:                                             │
│  1. Is origin in allowed list?                                       │
│  2. Is method allowed?                                               │
│  3. Are headers allowed?                                             │
│                                                                      │
│  Returns:                                                            │
│  - Access-Control-Allow-Origin: http://localhost:5173                │
│  - Access-Control-Allow-Methods: GET, POST, PUT, DELETE              │
│  - Access-Control-Allow-Headers: Content-Type, Authorization         │
│  - Access-Control-Max-Age: 86400                                     │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         │ 2. Preflight OK, now actual request
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ACTUAL REQUEST (GET)                              │
│                                                                      │
│  Browser sends actual request with data                              │
└──────────────────────────────────────────────────────────────────────┘
```

## Hono CORS Best Practices

### 1. Use Built-in Middleware

Hono provides a built-in `cors` middleware - don't implement manually.

```typescript
import { cors } from 'hono/cors';
```

### 2. Dynamic Origin Validation

Never use `origin: '*'` in production. Validate origins dynamically:

```typescript
cors({
  origin: (origin) => {
    const allowed = getAllowedOrigins(env);
    return allowed.includes(origin) ? origin : null;
  },
})
```

### 3. Environment-Based Configuration

Configure allowed origins per environment via `.dev.vars` / secrets.

## Implementation Plan

### Step 1: Add Environment Variable

Add `ALLOWED_ORIGINS` to `apps/data-service/.example.vars`:

```env
# ... existing vars ...

# CORS: Comma-separated allowed origins (for staging/production)
ALLOWED_ORIGINS=
```

Then regenerate types:

```bash
cd apps/data-service
pnpm run cf-typegen
```

This will add `ALLOWED_ORIGINS` to `Cloudflare.Env` in `worker-configuration.d.ts` automatically.

### Step 2: Create CORS Middleware

Create `apps/data-service/src/hono/middleware/cors.ts`:

```typescript
import { cors } from 'hono/cors';
import type { Context, Next } from 'hono';

/**
 * Get allowed origins based on environment
 */
const getAllowedOrigins = (env: Env): string[] => {
  // Development: Allow localhost
  if (env.CLOUDFLARE_ENV === 'dev') {
    return [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ];
  }

  // Staging/Production: Use ALLOWED_ORIGINS from secrets
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }

  return [];
};

/**
 * CORS middleware factory
 * 
 * @example
 * App.use('*', createCorsMiddleware());
 */
export const createCorsMiddleware = () => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const allowedOrigins = getAllowedOrigins(c.env);
    
    const corsMiddleware = cors({
      // Dynamic origin validation
      origin: (origin) => {
        return allowedOrigins.includes(origin) ? origin : undefined;
      },
      
      // Allowed HTTP methods
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      
      // Allowed request headers
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
      ],
      
      // Headers exposed to browser
      exposeHeaders: [
        'X-Total-Count',
        'X-Request-Id',
      ],
      
      // Allow cookies/auth headers
      credentials: true,
      
      // Cache preflight for 24 hours
      maxAge: 86400,
    });

    return corsMiddleware(c, next);
  };
};
```

### Step 3: Apply Middleware to App

Update `apps/data-service/src/hono/app.ts`:

```typescript
import { Hono } from "hono";
import { createCorsMiddleware } from "./middleware/cors";
import health from "./handlers/health-handlers";
import users from "./handlers/user-handlers";
import { errorHandler, onErrorHandler } from "./middleware/error-handler";

export const App = new Hono<{ Bindings: Env }>();

App.onError(onErrorHandler);
App.use('*', errorHandler());

// Apply CORS middleware BEFORE routes
App.use('*', createCorsMiddleware());

App.route('/health', health);
App.route('/users', users);
```

### Step 4: Configure Environment Variables

Update `apps/data-service/.example.vars`:

```env
CLOUDFLARE_ENV=dev
API_TOKEN=demo-api-token-12345

# CORS: Comma-separated allowed origins (for staging/production)
# ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
```

Create `apps/data-service/.dev.vars` (not committed):

```env
CLOUDFLARE_ENV=dev
API_TOKEN=demo-api-token-12345
```

## Configuration Reference

### CORS Options Explained

| Option | Value | Description |
|--------|-------|-------------|
| `origin` | Function | Validates request origin against allowed list |
| `allowMethods` | Array | HTTP methods allowed (GET, POST, etc.) |
| `allowHeaders` | Array | Request headers browser can send |
| `exposeHeaders` | Array | Response headers browser can access |
| `credentials` | `true` | Allow cookies and Authorization header |
| `maxAge` | `86400` | Preflight cache duration (24 hours) |

### Security Considerations

1. **Never use `origin: '*'` with `credentials: true`** - browsers reject this
2. **Validate all origins** - don't trust the Origin header blindly
3. **Limit exposed headers** - only expose what's needed
4. **Keep maxAge reasonable** - allows quick updates if needed

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No 'Access-Control-Allow-Origin' header" | Origin not in allowed list | Add origin to `ALLOWED_ORIGINS` |
| "Credentials flag is true but mode is 'cors'" | Missing `credentials: 'include'` in fetch | Add to fetch options |
| Preflight fails | Method or header not allowed | Add to `allowMethods`/`allowHeaders` |

## Testing CORS

### 1. Using Browser DevTools

```javascript
// In browser console (from user-application origin)
fetch('http://localhost:8787/users')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### 2. Using cURL

```bash
# Simulate preflight
curl -X OPTIONS http://localhost:8787/users \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Actual request with origin
curl http://localhost:8787/users \
  -H "Origin: http://localhost:5173" \
  -v
```

### 3. Check Response Headers

Expected headers in response:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

## Related Documents

- [001 - Demo Overview](./001-demo-overview.md) - Architecture overview
- [002 - Prerequisites Setup](./002-prerequisites-setup.md) - Environment and tokens
- [004 - GET Users (Client → API)](./004-get-users-client-api.md) - Uses CORS for direct API access
