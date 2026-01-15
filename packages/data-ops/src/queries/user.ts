import { getDb } from "@/database/setup";
import { auth_user } from "@/drizzle/auth-schema";
import { eq } from "drizzle-orm";

export async function getUser(userId: string) {
  const db = getDb();
  const [user] = await db
    .select({
      id: auth_user.id,
      name: auth_user.name,
      email: auth_user.email
    })
    .from(auth_user)
    .where(eq(auth_user.id, userId));
  return user;
}