import { z } from "zod";

// ============================================
// Response Schemas
// ============================================

export const DatabaseStatusSchema = z.enum(["connected", "disconnected"]);

export const LivenessResponseSchema = z.object({
	status: z.literal("ok"),
	time: z.string(),
});

export const ReadinessResponseSchema = z.object({
	status: z.enum(["ok", "degraded"]),
	env: z.string(),
	service: z.string(),
	time: z.string(),
	database: DatabaseStatusSchema,
});

// ============================================
// Types
// ============================================

export type DatabaseStatus = z.infer<typeof DatabaseStatusSchema>;
export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
