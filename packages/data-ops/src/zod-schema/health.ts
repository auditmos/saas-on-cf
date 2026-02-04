import { z } from 'zod';

// ============================================
// Response Schemas
// ============================================

export const HealthCheckResponseSchema = z.object({
  status: z.string(),
  env: z.string(),
  service: z.string(),
  time: z.string(),
  message: z.string(),
  version: z.string()
});

// ============================================
// Types
// ============================================

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
