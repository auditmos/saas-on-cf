import { WorkerEntrypoint } from "cloudflare:workers";
import { initDatabase } from "@repo/data-ops/database/setup";
import { App } from "@/hono/app";
import { handleQueue } from "./queues";
import { handleScheduled } from "./scheduled";

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		initDatabase({
			host: env.DATABASE_HOST,
			username: env.DATABASE_USERNAME,
			password: env.DATABASE_PASSWORD,
		});
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
