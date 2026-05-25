import { WorkerEntrypoint } from "cloudflare:workers";
import { setAuth } from "@repo/data-ops/auth/server";
import { getDb, initDatabase } from "@repo/data-ops/database/setup";
import { App } from "@/hono/app";
import { handleQueue } from "./queues";
import { handleScheduled } from "./scheduled";

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		if (!env.CLOUDFLARE_ENV) {
			throw new Error(
				"CLOUDFLARE_ENV is required — declare it in wrangler.jsonc vars per env block",
			);
		}
		initDatabase({
			host: env.DATABASE_HOST,
			username: env.DATABASE_USERNAME,
			password: env.DATABASE_PASSWORD,
		});
		const optionalEnv = env as unknown as Record<string, string | undefined>;
		setAuth({
			secret: optionalEnv.BETTER_AUTH_SECRET,
			baseURL: optionalEnv.BETTER_AUTH_BASE_URL,
			crossSubDomainCookieDomain: optionalEnv.BETTER_AUTH_COOKIE_DOMAIN || undefined,
			adapter: {
				drizzleDb: getDb(),
				provider: "pg",
			},
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
