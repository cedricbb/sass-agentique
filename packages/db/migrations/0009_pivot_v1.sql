-- ST6 pivot_v1: drop legacy multi-tenant tables/enums, add CRM + commercial + service tables
-- ⚠️  Migration NON appliquée — application manuelle par Cédric

-- Drop old tables (order: dependents first)
DROP TABLE IF EXISTS "invitations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "memberships" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "plans" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tenants" CASCADE;--> statement-breakpoint

-- Drop old enums
DROP TYPE IF EXISTS "public"."invitation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."membership_role";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."subscription_status";--> statement-breakpoint

-- Create new enums
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('company', 'individual');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'on_hold', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('stripe_card', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_kind" AS ENUM('delivery', 'monthly', 'audit', 'other');--> statement-breakpoint
CREATE TYPE "public"."prestation_kind" AS ENUM('one_shot', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."billing_mode" AS ENUM('stripe_auto', 'manual_invoice');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint

-- Alter users.role from text to user_role enum
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role"
    USING (CASE "role"
           WHEN 'admin' THEN 'admin'::"public"."user_role"
           ELSE 'client'::"public"."user_role"
         END);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'client';--> statement-breakpoint

-- Drop tenant_id from agent_tasks
ALTER TABLE "agent_tasks" DROP COLUMN IF EXISTS "tenant_id";--> statement-breakpoint

-- Create clients table
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "client_type" DEFAULT 'company' NOT NULL,
	"email" text,
	"phone" text,
	"billing_address" jsonb,
	"notes" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create client_contacts table
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create projects table
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"started_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create prestations table
CREATE TABLE "prestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_price_eur_cents" integer DEFAULT 0 NOT NULL,
	"kind" "prestation_kind" DEFAULT 'one_shot' NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create quotes table
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"number" text NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp,
	"expires_at" timestamp,
	"accepted_at" timestamp,
	"total_eur_cents" integer DEFAULT 0 NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create quote_items table
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"prestation_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_eur_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Create invoices table
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"quote_id" uuid,
	"project_id" uuid,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp,
	"due_at" timestamp,
	"paid_at" timestamp,
	"total_eur_cents" integer DEFAULT 0 NOT NULL,
	"vat_rate_bps" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create invoice_items table
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_eur_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint

-- Create payments table
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_eur_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"external_ref" text,
	"paid_at" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create reports table
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"kind" "report_kind" DEFAULT 'delivery' NOT NULL,
	"file_path" text NOT NULL,
	"summary" text,
	"issued_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create maintenance_contracts table
CREATE TABLE "maintenance_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"prestation_id" uuid NOT NULL,
	"billing_mode" "billing_mode" NOT NULL,
	"status" "maintenance_status" DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"monthly_price_eur_cents" integer NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"started_at" timestamp NOT NULL,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Unique indexes
CREATE UNIQUE INDEX "clients_slug_unique" ON "clients" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "client_contacts_client_user_unique" ON "client_contacts" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "projects_client_id_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prestations_slug_unique" ON "prestations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "prestations_stripe_product_unique" ON "prestations" USING btree ("stripe_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prestations_stripe_price_unique" ON "prestations" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_number_unique" ON "quotes" USING btree ("number");--> statement-breakpoint
CREATE INDEX "quotes_client_id_idx" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_stripe_pi_unique" ON "invoices" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "invoices_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "reports_client_id_idx" ON "reports" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_contracts_client_unique" ON "maintenance_contracts" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_contracts_stripe_sub_unique" ON "maintenance_contracts" USING btree ("stripe_subscription_id");--> statement-breakpoint

-- Foreign keys
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
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_prestation_id_prestations_id_fk" FOREIGN KEY ("prestation_id") REFERENCES "public"."prestations"("id") ON DELETE restrict ON UPDATE no action;
