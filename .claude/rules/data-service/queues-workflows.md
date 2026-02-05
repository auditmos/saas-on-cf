---
paths:
  - "apps/data-service/src/queues/**/*.ts"
  - "apps/data-service/src/workflows/**/*.ts"
---

# Cloudflare Queues & Workflows Rules

## Queues - Producer

- Transform data to JSON before sending
- Use typed message interfaces

```ts
interface UserCreatedMessage {
  type: 'user.created'
  userId: string
  timestamp: number
}

await env.MY_QUEUE.send({
  type: 'user.created',
  userId: user.id,
  timestamp: Date.now(),
} satisfies UserCreatedMessage)
```

## Queues - Consumer

- One consumer per queue
- Handle batches, not single messages
- Use try/catch per message for resilience
- Messages retry automatically on failure (4 day retention)

```ts
export default {
  async queue(batch: MessageBatch<UserCreatedMessage>, env: Env) {
    for (const msg of batch.messages) {
      try {
        await processMessage(msg.body, env)
        msg.ack()
      } catch (err) {
        console.error('Failed:', msg.id, err)
        msg.retry() // or let it auto-retry
      }
    }
  },
}
```

## Queue Config

Configure in `wrangler.jsonc`:
- `max_batch_size`: messages per batch (default 10)
- `max_batch_timeout`: wait time in seconds (default 5)

## Workflows - Structure

- Break work into idempotent steps
- Each step persists state automatically
- Failed steps retry from that point

```ts
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers'

export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const user = await step.do('fetch-user', async () => {
      return fetchUser(event.payload.userId)
    })

    await step.do('send-email', { retries: { limit: 3, delay: '5 seconds' } }, async () => {
      return sendWelcomeEmail(user.email)
    })
  }
}
```

## Workflow Patterns

- `step.do()`: execute and persist result
- `step.sleep()`: pause for duration
- `step.waitForEvent()`: pause for external trigger
- Access bindings via `this.env`

## Step Design

Ask: "If this fails, should everything re-run?"
- No → separate step
- External API call → own step
- DB write → own step
- Pure computation → can combine

## Error Handling

Configure per-step retries:

```ts
await step.do('risky-operation', {
  retries: {
    limit: 3,
    delay: '10 seconds',
    backoff: 'linear', // or 'exponential'
  },
}, async () => { ... })
```
