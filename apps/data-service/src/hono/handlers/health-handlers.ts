import { Hono } from 'hono';
import type { HealthCheckResponse } from '@repo/data-ops/zod-schema/responses/health';

const health = new Hono<{ Bindings: Env }>();

health.get('/', (c) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    env: c.env.CLOUDFLARE_ENV,
    service: 'saas-on-cf',
    time: new Date().toISOString(),
    message: 'Service healthy',
    version: '0.0.1',
  };
  return c.json(response);
});

export default health;