DROP INDEX "invoices_number_unique";--> statement-breakpoint
DROP INDEX "maintenance_contracts_client_unique";--> statement-breakpoint
DROP INDEX "prestations_slug_unique";--> statement-breakpoint
DROP INDEX "quotes_number_unique";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "prestations" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "clients" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "invoices" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "maintenance_contracts" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "payments" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "prestations" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "projects" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "quotes" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
UPDATE "reports" SET "owner_id" = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prestations" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_owner_id_idx" ON "clients" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_owner_number_unique" ON "invoices" USING btree ("owner_id","number");--> statement-breakpoint
CREATE INDEX "invoices_owner_id_idx" ON "invoices" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_contracts_owner_client_unique" ON "maintenance_contracts" USING btree ("owner_id","client_id");--> statement-breakpoint
CREATE INDEX "maintenance_contracts_owner_id_idx" ON "maintenance_contracts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "payments_owner_id_idx" ON "payments" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prestations_owner_slug_unique" ON "prestations" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "prestations_owner_id_idx" ON "prestations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_owner_number_unique" ON "quotes" USING btree ("owner_id","number");--> statement-breakpoint
CREATE INDEX "quotes_owner_id_idx" ON "quotes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "reports_owner_id_idx" ON "reports" USING btree ("owner_id");
