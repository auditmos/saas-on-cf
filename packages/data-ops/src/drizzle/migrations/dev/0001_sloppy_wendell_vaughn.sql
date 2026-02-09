ALTER TABLE "users" RENAME TO "clients";--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_email_unique" UNIQUE("email");