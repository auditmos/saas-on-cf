---
paths:
  - "apps/data-service/src/agents/**/*.ts"
---

# Cloudflare Agents SDK — Core

[Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) — higher-level abstraction over Durable Objects with built-in state sync, scheduling, queues, retries, workflows, SQLite, and WebSocket.

## Class Structure

Extend `Agent<Env, State>`. State auto-syncs to connected WS clients.

```ts
import { Agent, callable } from "agents"

export class MyAgent extends Agent<Env, MyState> {
  initialState: MyState = { /* defaults */ }
  static options = { hibernate: true, retry: { maxAttempts: 3 } }

  async onStart(props?) { /* init or wake from hibernation */ }
}
```

### Lifecycle hooks

- `onStart(props?)` — start or wake
- `onRequest(request)` — HTTP handler on instance
- `onConnect(conn, ctx)` / `onMessage(conn, msg)` / `onClose(conn, code, reason)` / `onError(conn, err)` — WS lifecycle
- `onStateChanged(state, source)` — post-state-change, source = `"server"` | Connection

## State Management

- `this.state` — current state (persisted in SQLite, synced to clients)
- `this.setState(newState)` — update + persist + broadcast to WS clients
- `this.sql` — per-instance SQLite for structured data
- `validateStateChange(nextState, source)` — synchronous guard, throw to reject

## Callable Methods

`@callable()` exposes methods to client via WS RPC. NOT needed for server-side calls.

```ts
@callable()
async doSomething(): Promise<Result> { ... }

@callable({ streaming: true })
async streamResults(stream: StreamingResponse, params: Params) {
  stream.send(chunk)
  stream.end(finalValue?)
}
```

## Scheduling

- `scheduleEvery(seconds, "methodName", payload)` — recurring, overlap prevention built-in
- `schedule(when, "methodName", payload)` — one-off (seconds | Date | cron string)
- `getSchedule(id)` / `getSchedules(criteria)` / `cancelSchedule(id)` — manage
- Schedules persist in SQLite, survive hibernation

## Queue Tasks

FIFO async task queue. SQLite-persisted, auto-processed, auto-dequeued on success.

```ts
const taskId = await this.queue("processItem", payload)
this.dequeue(taskId)
this.dequeueAll()
this.getQueue(taskId)
this.getQueues({ key: "type", value: "x" })
```

Use queues when: task must survive hibernation, needs retry, or must be sequential.

## Retry

Wrap all external API calls in `this.retry()`. Full jitter exponential backoff.

```ts
const result = await this.retry(
  (attempt) => externalApi.call(params),
  { maxAttempts: 3, shouldRetry: (err) => err.status >= 500 }
)
```

Always use `shouldRetry` to skip 4xx errors.

## Server-Side RPC

Use `getAgentByName()` for worker→agent calls. No `@callable()` needed.

```ts
import { getAgentByName } from "agents"
const agent = await getAgentByName<MyAgent>(env.MyAgent, instanceName)
await agent.someMethod(params)
```

## Client SDK

```tsx
// React hook — auto-reconnect, state sync
import { useAgent } from "agents/react"
const agent = useAgent<MyAgent>({ agent: "MyAgent", name: instanceId })
// agent.state — auto-synced
// agent.stub.doSomething() — type-safe RPC

// Vanilla JS/TS
import { AgentClient } from "agents/client"

// HTTP one-off (no WS)
import { agentFetch } from "agents/client"
```

## Entry Point & Routing

Route agent WS/HTTP before Hono. Use auth hooks for WS connections.

```ts
import { routeAgentRequest } from "agents"

export default {
  async fetch(request, env, ctx) {
    const agentResponse = await routeAgentRequest(request, env, {
      onBeforeConnect: async (req) => { /* verify auth before WS upgrade */ },
      onBeforeRequest: async (req) => { /* verify auth before HTTP */ },
    })
    if (agentResponse) return agentResponse
    return app.fetch(request, env, ctx)
  },
}
```

Always set `onBeforeConnect` to authenticate WS connections.

## Wrangler Config

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "MyAgent", "class_name": "MyAgent" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyAgent"] }]
}
```

Requires `new_sqlite_classes` (not `new_classes`). Add `"nodejs_compat"` to `compatibility_flags`.

## Key Differences from Raw DO

| Raw DO | Agents SDK |
|---|---|
| `ctx.storage.get/put` | `this.state` + `setState()` |
| `alarm()` handler | `scheduleEvery()` / `schedule()` |
| `fetch()` routing | `@callable()` + `getAgentByName()` |
| Manual WebSocket | Built-in WS + client SDK |
| No retry | `this.retry()` with jitter backoff |
| No task queue | `this.queue()` FIFO with retry |
