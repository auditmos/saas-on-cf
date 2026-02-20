---
paths:
  - "apps/data-service/src/agents/**/*.ts"
  - "apps/data-service/src/workflows/**/*.ts"
---

# Cloudflare Agents SDK Rules

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
- `onEmail(email)` — email routing
- `onStateChanged(state, source)` — post-state-change, source = `"server"` | Connection

## State Management

- `this.state` — current state (persisted in SQLite, synced to clients)
- `this.setState(newState)` — update + persist + broadcast to WS clients
- `this.sql` — per-instance SQLite for structured data
- `validateStateChange(nextState, source)` — synchronous guard, throw to reject before persist
- `onStateChanged(state, source)` — post-change hook

Always use `validateStateChange()` to enforce invariants:

```ts
validateStateChange(nextState: MyState, source: string | Connection) {
  if (!isValidTransition(this.state, nextState)) throw new Error("Invalid state transition")
}
```

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
- `getSchedule(id)` / `getSchedules(criteria)` / `cancelSchedule(id)` — manage schedules
- `getSchedulePrompt()` — system prompt for AI-assisted natural language scheduling
- `scheduleSchema` — Zod schema for schedule validation
- Schedules persist in SQLite, survive hibernation

## Queue Tasks

FIFO async task queue. SQLite-persisted, auto-processed, auto-dequeued on success.

```ts
const taskId = await this.queue("processItem", payload)

this.dequeue(taskId)                         // remove by ID
this.dequeueAll()                            // clear queue
this.dequeueAllByCallback("processItem")     // remove by callback
this.getQueue(taskId)                        // get single task
this.getQueues({ key: "type", value: "x" }) // filter by payload
```

Callback signature: `async processItem(payload: unknown, queueItem: QueueItem): Promise<void>`

Use queues when: task must survive hibernation, needs retry, or must be sequential.

## Retry

Wrap all external API calls in `this.retry()`. Full jitter exponential backoff.

```ts
const result = await this.retry(
  (attempt) => externalApi.call(params),
  { maxAttempts: 3, shouldRetry: (err) => err.status >= 500 }
)
```

- Options: `maxAttempts` (default 3), `baseDelayMs` (100), `maxDelayMs` (3000)
- `shouldRetry(err, nextAttempt)` — stop early on non-retryable errors (only on `this.retry()`)
- Class-level defaults: `static options = { retry: { maxAttempts: 5 } }`
- Retry also applies to: `schedule()`, `scheduleEvery()`, `queue()`, `addMcpServer()`

**Best practice**: always use `shouldRetry` to skip 4xx errors.

## Workflows

Multi-step durable processes with approval gates and per-step retry.

```ts
// Start from agent
const instanceId = await this.runWorkflow("myWorkflow", params)

// Control
await this.getWorkflowStatus("myWorkflow", instanceId)
await this.getWorkflows({ status: "running" })    // paginated
await this.approveWorkflow(instanceId)
await this.rejectWorkflow(instanceId, { reason })
await this.sendWorkflowEvent("myWorkflow", instanceId, event)
await this.terminateWorkflow(instanceId)
await this.pauseWorkflow(instanceId)
await this.resumeWorkflow(instanceId)
```

### AgentWorkflow class

```ts
class MyWorkflow extends AgentWorkflow {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const data = await step.do('fetch-data', { retries: { limit: 3 } }, () => fetchData())

    // Pause for external approval (hours/days/weeks)
    const decision = await step.waitForEvent('approval', {
      type: 'user_approval',
      timeout: '15 minutes',
    })

    if (decision.payload.action === 'approve') {
      await step.do('execute', () => doAction(data))
    }
  }
}
```

- `step.do(name, opts?, fn)` — durable step with optional retry
- `step.waitForEvent(name, opts)` — pause for external event (approval gate)
- `step.updateAgentState(state)` / `step.mergeAgentState(partial)` / `step.resetAgentState()`
- `reportProgress(progress)` / `broadcastToClients(message)` — non-durable helpers

### Agent lifecycle callbacks

- `onWorkflowProgress(name, id, progress)`
- `onWorkflowComplete(name, id, result?)`
- `onWorkflowError(name, id, error)`
- `onWorkflowEvent(name, id, event)`

**Best practice**: use workflows instead of manual approval tracking. `waitForEvent()` replaces polling + timeout crons.

## Observability

```ts
observability.emit({ type: "custom_event", displayMessage: "Something happened", ...payload })
```

- Built-in types: `connect`, `disconnect`, `state:update`, `message`, `error`, `schedule:execute`, `queue:process`
- Default: `console.log()`. Override with custom `Observability` interface. Disable: set `undefined`
- Integrate with external logging services via HTTP

## Readonly Connections

```ts
shouldConnectionBeReadonly(connection: Connection, ctx: ConnectionContext): boolean {
  return connection.metadata?.role === "viewer"
}
setConnectionReadonly(connection, true)  // dynamic toggle
isConnectionReadonly(connection)         // check
```

Readonly clients receive state updates but can't modify state or call state-mutating callables.

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

// Vanilla JS/TS (non-React)
import { AgentClient } from "agents/client"
const client = new AgentClient({ agent: "MyAgent", host: "api.example.com", name: instanceId })

// HTTP one-off (no WS)
import { agentFetch } from "agents/client"
```

Options: `onStateUpdate`, `onMcpUpdate`, `onOpen`, `onClose`, `onError`, `onMessage`, `query`, `queryDeps`, `cacheTtl`

## Entry Point & Routing

Route agent WS/HTTP before Hono. Use auth hooks for WS connections.

```ts
import { routeAgentRequest } from "agents"

export default {
  async fetch(request, env, ctx) {
    const agentResponse = await routeAgentRequest(request, env, {
      onBeforeConnect: async (req) => { /* verify auth before WS upgrade */ },
      onBeforeRequest: async (req) => { /* verify auth before HTTP */ },
      // basePath: "/agents"    — custom route prefix (default: /agents)
      // cors: true             — CORS config
      // locationHint: "enam"   — DO placement hint
      // jurisdiction: "eu"     — data residency
      // props: { ... }         — passed to onStart(props)
    })
    if (agentResponse) return agentResponse
    return app.fetch(request, env, ctx)
  },
}
```

**Best practice**: always set `onBeforeConnect` to authenticate WS connections.

## MCP Support

Agent as MCP server (expose tools) or MCP client (consume external tools).

```ts
// Client: connect to external MCP servers
await this.addMcpServer({ url: "https://mcp.example.com", ... })
this.getMcpServers()
this.removeMcpServer(id)
```

## AI Model Integration

```ts
// Workers AI (native binding)
const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", { prompt })

// AI Gateway (multi-provider fallback, caching, rate-limit visibility)
const result = await env.AI.gateway("my-gateway").run(model, params)
```

Supports: Workers AI, OpenAI, Anthropic, Gemini, Vercel AI SDK, any OpenAI-compatible endpoint.

## RAG / Vectorize

```ts
const embeddings = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: query })
const results = await env.VECTOR_DB.query(embeddings, { topK: 5, returnMetadata: true })
```

## Wrangler Config

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "MyAgent", "class_name": "MyAgent" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyAgent"] }],
  // Workflows (if using)
  "workflows": [{ "name": "my-workflow", "class_name": "MyWorkflow", "binding": "MY_WORKFLOW" }]
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
| Manual approval tracking | Workflows `waitForEvent()` |
| No observability | `observability.emit()` events |
