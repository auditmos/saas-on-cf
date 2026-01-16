import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
});

export const UserCreateRequest = z.object({
  name: z.string().min(1).max(30),
  email: z.string().email()
});

export const UserUpdateRequest = z.object({
  name: z.string().min(1).max(30).optional(),
  email: z.string().email().optional()
}).refine(data => data.name || data.email, {
  message: "At least one field required"
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0)
});

export const PaginationMetaSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean()
});

export const UserResponse = UserSchema;

export const UserListResponse = z.object({
  data: z.array(UserSchema),
  pagination: PaginationMetaSchema
});

export type User = z.infer<typeof UserSchema>;
export type UserCreateInput = z.infer<typeof UserCreateRequest>;
export type UserUpdateInput = z.infer<typeof UserUpdateRequest>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type UserListResponseData = z.infer<typeof UserListResponse>;
