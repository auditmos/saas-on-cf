import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	surname: text("surname").notNull(),
	email: text("email").notNull().unique(),
});
