---
paths:
  - "apps/data-service/src/agents/**/*.ts"
---

# Cloudflare Agents SDK Rules

TradingAgent uses [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) — higher-level abstraction over Durable Objects with built-in state sync, scheduling, SQLite, and WebSocket.

## Class Structure

Extend `Agent<Env, State>`. State auto-syncs to connected WS clients.

```ts
import { Agent, callable } from "agents"

export class TradingAgent extends Agent<Env, AgentState> {
  initialState: AgentState = { enabled: false }

  async onStart() {
    // Called on start or wake from hibernation
  }
}
```

## State Management

- `this.state` — current state (persisted in SQLite, synced to clients)
- `this.setState(newState)` — update + persist + broadcast to WS clients
- `this.sql` — per-instance SQLite for structured data (activity logs, config, caches)

## Callable Methods

`@callable()` exposes methods to client via WS RPC. NOT needed for server-side calls.

```ts
@callable()
async enable(): Promise<{ success: true }> { ... }

@callable({ streaming: true })
async streamAnalysis(stream: StreamingResponse, prompt: string) { ... }
```

## Scheduling

- `scheduleEvery(seconds, "methodName", payload)` — recurring, overlap prevention built-in
- `schedule(when, "methodName", payload)` — one-off (seconds | Date | cron string)
- `getSchedules()` / `cancelSchedule(id)` — manage schedules
- Schedules persist in SQLite, survive hibernation

## Server-Side RPC

Use `getAgentByName()` for worker→agent calls. No `@callable()` needed.

```ts
import { getAgentByName } from "agents"

const agent = await getAgentByName<TradingAgent>(env.TradingAgent, userId)
await agent.executeApproval(approvalId)
```

## Client Connection

```tsx
import { useAgent } from "agents/react"

const agent = useAgent<TradingAgent>({ agent: "TradingAgent", name: userId })
// agent.state — auto-synced
// agent.stub.enable() — type-safe RPC
```

## Wrangler Config

Requires `new_sqlite_classes` (not `new_classes`):

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "TradingAgent", "class_name": "TradingAgent" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["TradingAgent"] }]
}
```

## Entry Point

Route agent WS/HTTP before Hono:

```ts
import { routeAgentRequest } from "agents"

export default {
  async fetch(request, env, ctx) {
    const agentResponse = await routeAgentRequest(request, env)
    if (agentResponse) return agentResponse
    return app.fetch(request, env, ctx)
  },
}
```

## Key Differences from Raw DO

| Raw DO | Agents SDK |
|---|---|
| `ctx.storage.get/put` | `this.state` + `setState()` |
| `alarm()` handler | `scheduleEvery()` / `schedule()` |
| `fetch()` routing | `@callable()` + `getAgentByName()` |
| Manual WebSocket | Built-in WS + client SDK |
