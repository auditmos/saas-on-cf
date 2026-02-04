import { WorkerEntrypoint } from "cloudflare:workers";
import { App } from "@/hono/app";
import { initDatabase } from "@repo/data-ops/database/setup";
import { handleScheduled } from "./scheduled";
import { handleQueue } from "./queues";

export default class DataService extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env)
    console.log(`Data Service Worker starting up on ${env.CLOUDFLARE_ENV} environment`);
		initDatabase({
      host: env.DATABASE_HOST,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
    })
	}
  fetch(request: Request) {
    return App.fetch(request, this.env, this.ctx);
  }

  async scheduled(controller: ScheduledController) {
    await handleScheduled(controller, this.env, this.ctx);
  }

  async queue(batch: MessageBatch<ExampleQueueMessage>) {
    await handleQueue(batch, this.env);
  }
}
