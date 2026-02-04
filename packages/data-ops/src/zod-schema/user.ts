import { z } from "zod";

// ============================================
// Domain Models (database entities)
// ============================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  surname: z.string(),
  email: z.string().email()
});

// ============================================
// Request Schemas
// ============================================

export const UserCreateRequestSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(30, 'Name must be at most 30 characters'),
  surname: z.string()
    .min(1, 'Surname is required')
    .max(30, 'Surname must be at most 30 characters'),
  email: z.string().email('Invalid email format')
});

export const UserUpdateRequestSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  surname: z.string().min(1).max(30).optional(),
  email: z.string().email().optional()
}).refine(data => data.name || data.surname || data.email, {
  message: "At least one field required"
});

export const PaginationRequestSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0)
});

export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format')
});

// ============================================
// Response Schemas
// ============================================

export const PaginationMetaSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean()
});

export const UserResponseSchema = UserSchema;

export const UserListResponseSchema = z.object({
  data: z.array(UserSchema),
  pagination: PaginationMetaSchema
});

export const ErrorResponseSchema = z.object({
  message: z.string().optional(),
  code: z.string().optional()
});

// ============================================
// Types
// ============================================

export type User = z.infer<typeof UserSchema>;
export type UserCreateInput = z.infer<typeof UserCreateRequestSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateRequestSchema>;
export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UserListResponse = z.infer<typeof UserListResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
