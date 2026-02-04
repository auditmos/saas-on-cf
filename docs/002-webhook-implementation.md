# Webhook Implementation - Inbound Reference

## Overview

Two inbound webhook endpoints in data-service that receive user events from external systems. Both verify signatures per [standard-webhooks](https://github.com/standard-webhooks/standard-webhooks), log every request to `webhook_logs`, and follow the handlers -> services -> data-ops pattern.

- `POST /webhooks/user.sync` - syncs user data into DB. Basic reference implementation.
- `POST /webhooks/user.action` - receives user action events, logs to DB. Structured for later CF Queue/Workflow enhancement.

## Signature Verification

All inbound webhooks require standard-webhooks headers:

| Header | Description |
|--------|-------------|
| `webhook-id` | Unique message ID (UUID) |
| `webhook-timestamp` | Unix epoch seconds |
| `webhook-signature` | `v1,<base64 HMAC-SHA256>` (space-separated if multiple keys) |

Signed content: `${webhook-id}.${webhook-timestamp}.${raw body}`

Verification middleware runs before any handler logic. Timestamp tolerance: 5 minutes (replay protection). Comparison is constant-time.

## DB Schema

### `webhook_logs` table (`packages/data-ops/src/drizzle/schema.ts`)

```typescript
import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";

export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  msgId: text("msg_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("received"),  // received | processed | failed
  payload: jsonb("payload").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`msgId` unique constraint provides idempotency - duplicate deliveries are rejected at the DB level.

## Zod Schemas (`packages/data-ops/src/zod-schema/webhook.ts`)

```typescript
import { z } from "zod";

// ============================================
// Webhook headers (extracted before body parse)
// ============================================

export const WebhookHeadersSchema = z.object({
  "webhook-id": z.string(),
  "webhook-timestamp": z.string(),
  "webhook-signature": z.string(),
});

// ============================================
// user.sync event
// ============================================

export const UserSyncPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
  surname: z.string(),
});

export const UserSyncEventSchema = z.object({
  type: z.literal("user.sync"),
  data: UserSyncPayloadSchema,
});

// ============================================
// user.action event
// ============================================

export const UserActionPayloadSchema = z.object({
  userId: z.string(),
  action: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const UserActionEventSchema = z.object({
  type: z.literal("user.action"),
  data: UserActionPayloadSchema,
});

// ============================================
// Types
// ============================================

export type WebhookHeaders = z.infer<typeof WebhookHeadersSchema>;
export type UserSyncEvent = z.infer<typeof UserSyncEventSchema>;
export type UserSyncPayload = z.infer<typeof UserSyncPayloadSchema>;
export type UserActionEvent = z.infer<typeof UserActionEventSchema>;
export type UserActionPayload = z.infer<typeof UserActionPayloadSchema>;
```

## Queries (`packages/data-ops/src/queries/webhook.ts`)

```typescript
import { eq } from "drizzle-orm";
import { getDb } from "../database/setup";
import { webhookLogs } from "../drizzle/schema";
import { users } from "../drizzle/schema";
import type { UserSyncPayload } from "../zod-schema/webhook";

interface WebhookLogEntry {
  msgId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status?: string;
  error?: string;
}

export async function insertWebhookLog(entry: WebhookLogEntry): Promise<void> {
  const db = getDb();
  await db
    .insert(webhookLogs)
    .values({
      msgId: entry.msgId,
      eventType: entry.eventType,
      payload: entry.payload,
      status: entry.status ?? "received",
      error: entry.error,
    })
    .onConflictDoNothing();  // idempotent - duplicate msgId is a no-op
}

export async function updateWebhookLogStatus(
  msgId: string,
  status: string,
  error?: string
): Promise<void> {
  const db = getDb();
  await db
    .update(webhookLogs)
    .set({ status, error })
    .where(eq(webhookLogs.msgId, msgId));
}

export async function getWebhookLogByMsgId(msgId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.msgId, msgId));
  return result.length > 0;
}

export async function upsertUser(data: UserSyncPayload): Promise<void> {
  const db = getDb();
  await db
    .insert(users)
    .values({
      name: data.name,
      surname: data.surname,
      email: data.email,
    })
    .onConflictDoNothing();
}
```

## Services (`apps/data-service/src/hono/services/`)

### `webhook-verify.ts` - signature verification

```typescript
interface VerifyParams {
  signature: string;
  msgId: string;
  timestamp: string;
  body: string;
  secret: string;
}

export async function verifyWebhookSignature({
  signature,
  msgId,
  timestamp,
  body,
  secret,
}: VerifyParams): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;  // 5 min tolerance

  const signedContent = `${msgId}.${timestamp}.${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)));

  // supports key rotation: header may contain multiple space-separated signatures
  const signatures = signature.split(" ");
  for (const sig of signatures) {
    if (!sig.startsWith("v1,")) continue;
    if (constantTimeEqual(sig, `v1,${expectedB64}`)) return true;
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

### `webhook-service.ts` - business logic for each event type

```typescript
import { HTTPException } from "hono/http-exception";
import {
  insertWebhookLog,
  updateWebhookLogStatus,
  getWebhookLogByMsgId,
  upsertUser,
} from "@repo/data-ops/queries/webhook";
import type { UserSyncPayload, UserActionPayload } from "@repo/data-ops/zod-schema/webhook";

interface WebhookContext {
  msgId: string;
  eventType: string;
}

export async function handleUserSync(
  ctx: WebhookContext,
  data: UserSyncPayload
): Promise<void> {
  // idempotency check - already processed this msgId
  if (await getWebhookLogByMsgId(ctx.msgId)) return;

  await insertWebhookLog({
    msgId: ctx.msgId,
    eventType: ctx.eventType,
    payload: data as unknown as Record<string, unknown>,
  });

  try {
    await upsertUser(data);
    await updateWebhookLogStatus(ctx.msgId, "processed");
  } catch (error) {
    await updateWebhookLogStatus(
      ctx.msgId,
      "failed",
      error instanceof Error ? error.message : "unknown error"
    );
    throw new HTTPException(500, { message: "Failed to sync user" });
  }
}

export async function handleUserAction(
  ctx: WebhookContext,
  data: UserActionPayload
): Promise<void> {
  if (await getWebhookLogByMsgId(ctx.msgId)) return;

  await insertWebhookLog({
    msgId: ctx.msgId,
    eventType: ctx.eventType,
    payload: data as unknown as Record<string, unknown>,
  });

  try {
    // TODO: enqueue to CF Queue for async processing
    // env.MY_QUEUE.send({ type: ctx.eventType, data });

    // TODO: or trigger CF Workflow
    // const instance = await env.MY_WORKFLOW.create({ params: { ... } });

    await updateWebhookLogStatus(ctx.msgId, "processed");
  } catch (error) {
    await updateWebhookLogStatus(
      ctx.msgId,
      "failed",
      error instanceof Error ? error.message : "unknown error"
    );
    throw new HTTPException(500, { message: "Failed to handle user action" });
  }
}
```

## Handler (`apps/data-service/src/hono/handlers/webhook-handlers.ts`)

Signature verification runs as the first middleware on the router. The raw body must be read before Zod parses it (needed for signature computation). Each route then validates the parsed body against its event schema.

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { UserSyncEventSchema, UserActionEventSchema } from "@repo/data-ops/zod-schema/webhook";
import { verifyWebhookSignature } from "../services/webhook-verify";
import * as webhookService from "../services/webhook-service";

const webhooks = new Hono<{ Bindings: Env }>();

// signature verification middleware - applies to all /webhooks/* routes
webhooks.use("*", async (c, next) => {
  const msgId = c.req.header("webhook-id");
  const timestamp = c.req.header("webhook-timestamp");
  const signature = c.req.header("webhook-signature");

  if (!msgId || !timestamp || !signature) {
    throw new HTTPException(400, { message: "Missing webhook headers" });
  }

  // read raw body, store for both signature check and downstream parsing
  const body = await c.req.text();
  c.set("webhookBody", body);
  c.set("webhookMsgId", msgId);
  c.set("webhookTimestamp", timestamp);

  const valid = await verifyWebhookSignature({
    signature,
    msgId,
    timestamp,
    body,
    secret: c.env.WEBHOOK_SECRET,
  });

  if (!valid) {
    throw new HTTPException(401, { message: "Invalid signature" });
  }

  await next();
});

// user.sync - syncs user data, stores in DB, logs the call
webhooks.post("/user.sync", async (c) => {
  const body = c.get("webhookBody");
  const event = UserSyncEventSchema.parse(JSON.parse(body));

  await webhookService.handleUserSync(
    { msgId: c.get("webhookMsgId"), eventType: event.type },
    event.data
  );

  return c.json({ received: true });
});

// user.action - receives action event, logs to DB, queue-ready
webhooks.post("/user.action", async (c) => {
  const body = c.get("webhookBody");
  const event = UserActionEventSchema.parse(JSON.parse(body));

  await webhookService.handleUserAction(
    { msgId: c.get("webhookMsgId"), eventType: event.type },
    event.data
  );

  return c.json({ received: true });
});

export default webhooks;
```

## Wire-up (`apps/data-service/src/hono/app.ts`)

```typescript
import webhooks from "./handlers/webhook-handlers";

App.route("/webhooks", webhooks);
```

## File Structure

```
packages/data-ops/src/
├── drizzle/
│   └── schema.ts                  # Add: webhookLogs table
├── zod-schema/
│   └── webhook.ts                 # New: event schemas + types
└── queries/
    └── webhook.ts                 # New: log insert/update, upsertUser

apps/data-service/src/hono/
├── app.ts                         # Add: App.route('/webhooks', webhooks)
├── handlers/
│   └── webhook-handlers.ts        # New: verify middleware + route handlers
└── services/
    ├── webhook-verify.ts          # New: HMAC-SHA256 verification
    └── webhook-service.ts         # New: handleUserSync, handleUserAction
```

## Environment Variables

Add to `.dev.vars`:

```
WEBHOOK_SECRET=whsec_your-secret-key-here
```

Run `pnpm run cf-typegen` after adding.

## Testing with curl

Generate a valid signature first. This script computes it using the same algorithm the sender uses:

```bash
# Generate signature for a test payload
MSG_ID=$(uuidgen)
TIMESTAMP=$(date +%s)
BODY='{"type":"user.sync","data":{"userId":"ext-123","email":"alice@example.com","name":"Alice","surname":"Smith"}}'
SECRET="whsec_your-secret-key-here"

SIGNED_CONTENT="${MSG_ID}.${TIMESTAMP}.${BODY}"
SIGNATURE="v1,$(echo -n "$SIGNED_CONTENT" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)"

# user.sync
curl -X POST http://localhost:8787/webhooks/user.sync \
  -H "Content-Type: application/json" \
  -H "webhook-id: $MSG_ID" \
  -H "webhook-timestamp: $TIMESTAMP" \
  -H "webhook-signature: $SIGNATURE" \
  -d "$BODY"

# Expected: {"received":true}
```

```bash
# user.action
MSG_ID=$(uuidgen)
TIMESTAMP=$(date +%s)
BODY='{"type":"user.action","data":{"userId":"ext-123","action":"login","metadata":{"ip":"1.2.3.4"}}}'
SECRET="whsec_your-secret-key-here"

SIGNED_CONTENT="${MSG_ID}.${TIMESTAMP}.${BODY}"
SIGNATURE="v1,$(echo -n "$SIGNED_CONTENT" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)"

curl -X POST http://localhost:8787/webhooks/user.action \
  -H "Content-Type: application/json" \
  -H "webhook-id: $MSG_ID" \
  -H "webhook-timestamp: $TIMESTAMP" \
  -H "webhook-signature: $SIGNATURE" \
  -d "$BODY"

# Expected: {"received":true}
```

Missing or invalid signature returns 401. Missing headers returns 400. Duplicate `webhook-id` is silently accepted (idempotent no-op, returns 200).

## Migration Steps

1. Add `webhookLogs` to `packages/data-ops/src/drizzle/schema.ts`
2. `pnpm run drizzle:dev:generate && pnpm run drizzle:dev:migrate`
3. Create `packages/data-ops/src/zod-schema/webhook.ts`
4. Create `packages/data-ops/src/queries/webhook.ts`
5. `pnpm --filter @repo/data-ops build`
6. Create `apps/data-service/src/hono/services/webhook-verify.ts`
7. Create `apps/data-service/src/hono/services/webhook-service.ts`
8. Create `apps/data-service/src/hono/handlers/webhook-handlers.ts`
9. Wire route in `apps/data-service/src/hono/app.ts`
10. Add `WEBHOOK_SECRET` to `.dev.vars`

## References

- [Standard Webhooks Spec](https://github.com/standard-webhooks/standard-webhooks)
- `docs/001-user-api-endpoints.md` - handler/service/query pattern reference
- `packages/data-ops/CLAUDE.md` - new table workflow
