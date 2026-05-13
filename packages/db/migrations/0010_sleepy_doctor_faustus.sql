ALTER TABLE "client_contacts" DROP CONSTRAINT "client_contacts_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "client_contacts" DROP CONSTRAINT "client_contacts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_quote_id_quotes_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_prestation_id_prestations_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_quote_id_quotes_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_contracts" DROP CONSTRAINT "maintenance_contracts_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenance_contracts" DROP CONSTRAINT "maintenance_contracts_prestation_id_prestations_id_fk";
--> statement-breakpoint
ALTER TABLE "client_contacts" ALTER COLUMN "is_primary" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "prestations" ALTER COLUMN "base_price_eur_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "prestations" ALTER COLUMN "is_active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "prestations" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "total_eur_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "vat_rate_bps" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_items" ALTER COLUMN "quantity" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "quote_items" ALTER COLUMN "unit_price_eur_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "quote_items" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "total_eur_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "vat_rate_bps" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "quantity" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "unit_price_eur_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_prestation_id_prestations_id_fk" FOREIGN KEY ("prestation_id") REFERENCES "public"."prestations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_prestation_id_prestations_id_fk" FOREIGN KEY ("prestation_id") REFERENCES "public"."prestations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_client_slug_unique" ON "projects" USING btree ("client_id","slug");