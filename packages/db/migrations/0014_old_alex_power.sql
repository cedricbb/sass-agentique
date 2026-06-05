DROP INDEX "maintenance_contracts_owner_client_unique";--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_contracts_owner_client_active_unique" ON "maintenance_contracts" USING btree ("owner_id","client_id") WHERE status <> 'canceled';