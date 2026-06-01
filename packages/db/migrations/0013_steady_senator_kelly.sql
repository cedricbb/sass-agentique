ALTER TABLE "customer_invitations" DROP CONSTRAINT "customer_invitations_token_unique";--> statement-breakpoint
ALTER TABLE "client_contacts" DROP CONSTRAINT "client_contacts_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "client_contacts_client_user_unique";--> statement-breakpoint
ALTER TABLE "client_contacts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_user_id_idx" ON "client_contacts" USING btree ("user_id");