---
paths:
  - "apps/data-service/src/durable-objects/**/*.ts"
---

# Cloudflare Durable Objects Rules

## Class Structure

- Extend `DurableObject` base class
- Constructor receives `ctx` (state/storage) and `env` (bindings)
- Public methods exposed as RPC

```ts
import { DurableObject } from 'cloudflare:workers'

export class Counter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  async increment(): Promise<number> {
    const value = (await this.ctx.storage.get<number>('count')) ?? 0
    const newValue = value + 1
    await this.ctx.storage.put('count', newValue)
    return newValue
  }
}
```

## Accessing DOs

- DOs don't receive direct internet requests
- Access via Worker using stubs

```ts
// In worker
const id = env.COUNTER.idFromName('global')
const stub = env.COUNTER.get(id)
const count = await stub.increment()
```

## State & Storage

- `ctx.storage.get(key)` / `put(key, value)` for simple KV
- `ctx.storage.sql` for SQLite queries (if enabled)
- State persists across requests
- Use transactions for atomic operations

```ts
await this.ctx.storage.transaction(async (txn) => {
  const balance = await txn.get<number>('balance') ?? 0
  await txn.put('balance', balance - amount)
})
```

## Alarms

Schedule future execution:

```ts
async scheduleReminder(delayMs: number) {
  await this.ctx.storage.setAlarm(Date.now() + delayMs)
}

async alarm() {
  // Triggered at scheduled time
  await this.sendReminder()
}
```

## WebSocket Handling

DOs excel at WebSocket connections:

```ts
async fetch(request: Request): Promise<Response> {
  const [client, server] = Object.values(new WebSocketPair())
  this.ctx.acceptWebSocket(server)
  return new Response(null, { status: 101, webSocket: client })
}

async webSocketMessage(ws: WebSocket, message: string) {
  // Handle incoming message
}
```

## Migrations

Add to `wrangler.jsonc` when creating new DO classes:

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "COUNTER", "class_name": "Counter" }]
  },
  "migrations": [
    { "tag": "v1", "new_classes": ["Counter"] }
  ]
}
```

## Best Practices

- Keep DO logic focused on coordination/state
- Offload heavy compute to regular Workers
- Use unique IDs for isolated instances
- Use named IDs for shared/global state
