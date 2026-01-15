import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
});

export type UserSchema = z.infer<typeof UserSchema>;
