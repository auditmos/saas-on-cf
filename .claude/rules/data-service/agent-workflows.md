---
paths:
  - "apps/data-service/src/agents/**/*.ts"
  - "apps/data-service/src/workflows/**/*.ts"
---

# Agents SDK — Workflows, MCP & AI

## Workflows

Multi-step durable processes with approval gates and per-step retry.

```ts
const instanceId = await this.runWorkflow("myWorkflow", params)
await this.getWorkflowStatus("myWorkflow", instanceId)
await this.approveWorkflow(instanceId)
await this.rejectWorkflow(instanceId, { reason })
await this.sendWorkflowEvent("myWorkflow", instanceId, event)
await this.terminateWorkflow(instanceId)
```

### AgentWorkflow class

```ts
class MyWorkflow extends AgentWorkflow {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const data = await step.do('fetch-data', { retries: { limit: 3 } }, () => fetchData())

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

### Agent lifecycle callbacks

- `onWorkflowProgress(name, id, progress)`
- `onWorkflowComplete(name, id, result?)`
- `onWorkflowError(name, id, error)`

Use workflows instead of manual approval tracking. `waitForEvent()` replaces polling + timeout crons.

### Wrangler config

```jsonc
"workflows": [{ "name": "my-workflow", "class_name": "MyWorkflow", "binding": "MY_WORKFLOW" }]
```

## Observability

```ts
observability.emit({ type: "custom_event", displayMessage: "Something happened", ...payload })
```

Built-in types: `connect`, `disconnect`, `state:update`, `message`, `error`, `schedule:execute`, `queue:process`.

## Readonly Connections

```ts
shouldConnectionBeReadonly(connection: Connection, ctx: ConnectionContext): boolean {
  return connection.metadata?.role === "viewer"
}
setConnectionReadonly(connection, true)
isConnectionReadonly(connection)
```

## MCP Support

Agent as MCP server (expose tools) or MCP client (consume external tools).

```ts
await this.addMcpServer({ url: "https://mcp.example.com", ... })
this.getMcpServers()
this.removeMcpServer(id)
```

## AI Model Integration

```ts
// Workers AI (native binding)
const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", { prompt })

// AI Gateway (multi-provider fallback, caching)
const result = await env.AI.gateway("my-gateway").run(model, params)
```

## RAG / Vectorize

```ts
const embeddings = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: query })
const results = await env.VECTOR_DB.query(embeddings, { topK: 5, returnMetadata: true })
```
