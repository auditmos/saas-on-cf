# Webhook Implementation Reference

## Overview

Reference implementation for sending webhooks following [standard-webhooks spec](https://github.com/standard-webhooks/standard-webhooks). Uses HMAC-SHA256 signature verification, proper headers, and exponential backoff retries.

## Goals

- Standard-webhooks compliant implementation
- HMAC-SHA256 signature verification (symmetric)
- Required headers: webhook-id, webhook-timestamp, webhook-signature
- Exponential backoff with retry logic
- TypeScript with proper interfaces (no `any` types)
- Hono framework patterns

## Webhook Flow

1. Event occurs → trigger webhook
2. Generate webhook-id (UUID), timestamp
3. Sign payload: `id.timestamp.payload`
4. Send POST to endpoint with headers
5. Retry on failure (exponential backoff)
6. Consumer verifies signature

## Implementation

### Schemas (`packages/data-ops/src/zod-schema/webhook.ts`)

```typescript
import { z } from 'zod';

// Base schema
export const WebhookEventSchema = z.object({
  type: z.string(),        // e.g., "user.created"
  timestamp: z.string(),   // ISO 8601
  data: z.unknown()        // event-specific payload
});

// Typed event schemas
export const UserCreatedDataSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  createdAt: z.string()
});

export const UserUpdatedDataSchema = z.object({
  userId: z.string(),
  changes: z.record(z.string(), z.unknown())
});

export const UserCreatedEventSchema = z.object({
  type: z.literal('user.created'),
  timestamp: z.string(),
  data: UserCreatedDataSchema
});

export const UserUpdatedEventSchema = z.object({
  type: z.literal('user.updated'),
  timestamp: z.string(),
  data: UserUpdatedDataSchema
});

// Union of all typed events
export const TypedWebhookEventSchema = z.discriminatedUnion('type', [
  UserCreatedEventSchema,
  UserUpdatedEventSchema
]);

export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;
export type UserUpdatedEvent = z.infer<typeof UserUpdatedEventSchema>;
export type TypedWebhookEvent = z.infer<typeof TypedWebhookEventSchema>;

export const WebhookEndpointSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  secret: z.string(),      // whsec_... prefix
  enabled: z.boolean()
});

export const WebhookDeliverySchema = z.object({
  id: z.string(),
  endpointId: z.string(),
  eventType: z.string(),
  status: z.enum(['pending', 'success', 'failed', 'disabled']),
  attempts: z.number(),
  lastAttemptAt: z.string().optional(),
  nextRetryAt: z.string().optional()
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;
```

### Signature Generation (`apps/data-service/src/services/webhook-signature.ts`)

```typescript
interface SignatureParams {
  msgId: string;
  timestamp: number;
  payload: string;
  secret: string;
}

export async function generateSignature({
  msgId,
  timestamp,
  payload,
  secret
}: SignatureParams): Promise<string> {
  const signedContent = `${msgId}.${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(signedContent);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `v1,${base64Sig}`;
}
```

### Signature Verification (`apps/data-service/src/services/webhook-verify.ts`)

```typescript
interface VerifyParams {
  signature: string;
  msgId: string;
  timestamp: number;
  payload: string;
  secret: string;
  toleranceSeconds?: number;
}

export async function verifySignature({
  signature,
  msgId,
  timestamp,
  payload,
  secret,
  toleranceSeconds = 300 // 5 min default
}: VerifyParams): Promise<boolean> {
  // Check timestamp tolerance (replay attack prevention)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  // Extract signatures (supports key rotation)
  const signatures = signature.split(' ').map(s => s.trim());

  // Verify any signature matches
  for (const sig of signatures) {
    if (!sig.startsWith('v1,')) continue;

    const expectedSig = await generateSignature({
      msgId,
      timestamp,
      payload,
      secret
    });

    // Constant-time comparison
    if (constantTimeEqual(sig, expectedSig)) {
      return true;
    }
  }

  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

### Webhook Sender (`apps/data-service/src/services/webhook-sender.ts`)

```typescript
import { generateSignature } from './webhook-signature';
import type { WebhookEvent, WebhookEndpoint } from '@repo/data-ops/zod-schema/webhook';

interface SendWebhookParams {
  event: WebhookEvent;
  endpoint: WebhookEndpoint;
}

interface RetryConfig {
  maxAttempts: number;
  delays: number[];  // ms: [0, 5000, 300000, 1800000, ...]
}

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 7,
  delays: [0, 5000, 300000, 1800000, 7200000, 21600000, 86400000]
};

export async function sendWebhook({
  event,
  endpoint
}: SendWebhookParams): Promise<void> {
  const msgId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify(event);

  const signature = await generateSignature({
    msgId,
    timestamp,
    payload,
    secret: endpoint.secret
  });

  await deliverWithRetry({
    url: endpoint.url,
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': msgId,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signature
    },
    body: payload
  });
}

interface DeliveryParams {
  url: string;
  headers: Record<string, string>;
  body: string;
  attempt?: number;
  config?: RetryConfig;
}

async function deliverWithRetry({
  url,
  headers,
  body,
  attempt = 0,
  config = DEFAULT_RETRY
}: DeliveryParams): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (response.status === 410) {
      // Endpoint disabled, don't retry
      throw new Error('Endpoint disabled (410 Gone)');
    }

    if (response.status >= 200 && response.status < 300) {
      return; // Success
    }

    // Retry on failure
    if (attempt < config.maxAttempts - 1) {
      const delay = config.delays[attempt + 1];
      await scheduleRetry({ url, headers, body, attempt: attempt + 1, config }, delay);
    } else {
      throw new Error(`Webhook delivery failed after ${config.maxAttempts} attempts`);
    }
  } catch (error) {
    if (attempt < config.maxAttempts - 1) {
      const delay = config.delays[attempt + 1];
      await scheduleRetry({ url, headers, body, attempt: attempt + 1, config }, delay);
    } else {
      throw error;
    }
  }
}

async function scheduleRetry(params: DeliveryParams, delayMs: number): Promise<void> {
  // In production: use Durable Objects or Queue
  // For sample: simple setTimeout
  return new Promise((resolve) => {
    setTimeout(async () => {
      await deliverWithRetry(params);
      resolve();
    }, delayMs);
  });
}
```

### Webhook Handler (Consumer Example)

```typescript
import { Hono } from 'hono';
import { verifySignature } from '../services/webhook-verify';

const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post('/receive', async (c) => {
  const signature = c.req.header('webhook-signature');
  const msgId = c.req.header('webhook-id');
  const timestampStr = c.req.header('webhook-timestamp');

  if (!signature || !msgId || !timestampStr) {
    return c.json({ error: 'Missing webhook headers' }, 400);
  }

  const timestamp = parseInt(timestampStr, 10);
  const payload = await c.req.text();

  const isValid = await verifySignature({
    signature,
    msgId,
    timestamp,
    payload,
    secret: c.env.WEBHOOK_SECRET
  });

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Process webhook (check idempotency using msgId)
  const event = JSON.parse(payload);

  // Your business logic here
  console.log('Webhook received:', event.type);

  return c.json({ received: true });
});

export default webhooks;
```

### Simple Webhook Endpoint (No Crypto)

For internal/trusted sources where signature verification isn't required.

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { TypedWebhookEventSchema } from '@repo/data-ops/zod-schema/webhook';

const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post(
  '/events',
  zValidator('json', TypedWebhookEventSchema),
  async (c) => {
    const event = c.req.valid('json');

    switch (event.type) {
      case 'user.created':
        // event.data is typed as { userId, email, createdAt }
        await handleUserCreated(event.data);
        break;
      case 'user.updated':
        // event.data is typed as { userId, changes }
        await handleUserUpdated(event.data);
        break;
    }

    return c.json({ received: true });
  }
);

async function handleUserCreated(data: { userId: string; email: string; createdAt: string }) {
  console.log('User created:', data.userId);
}

async function handleUserUpdated(data: { userId: string; changes: Record<string, unknown> }) {
  console.log('User updated:', data.userId);
}

export default webhooks;
```

**When to use:**
- Internal service-to-service communication
- Trusted webhook providers (Stripe, GitHub with IP allowlist)
- Development/testing environments

**When to use full verification:**
- Public-facing webhook endpoints
- Untrusted or unknown sources
- Production with external integrations

## File Structure

```
apps/data-service/src/
├── hono/
│   ├── app.ts                          # Add: App.route('/webhooks', webhooks)
│   └── handlers/
│       └── webhook-handlers.ts         # Consumer endpoint
└── services/
    ├── webhook-signature.ts            # Sign/verify logic
    ├── webhook-verify.ts               # Verification helper
    └── webhook-sender.ts               # Send + retry logic

packages/data-ops/src/zod-schema/
└── webhook.ts                          # Schemas + types
```

## Security Considerations

- **Constant-time comparison**: Prevents timing attacks
- **Timestamp validation**: Prevents replay attacks (5 min tolerance)
- **HTTPS only**: Encrypt payload in transit
- **Unique secrets per endpoint**: Isolate credential exposure
- **Idempotency**: Use webhook-id to dedupe processing
- **Key rotation**: Support multiple signatures in header

## Production Enhancements

- Use Cloudflare Queues or Durable Objects for retry scheduling
- Store delivery attempts in database
- Expose API for manual retry
- Add endpoint management CRUD
- Event filtering per endpoint
- Delivery status dashboard
- Rate limiting per endpoint

## Environment Variables

```
WEBHOOK_SECRET=whsec_your-secret-key-here
```

## References

- [Standard Webhooks Spec](https://github.com/standard-webhooks/standard-webhooks)
- [Cloudflare Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
