import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  json,
  jsonb,
  boolean,
  uniqueIndex,
  index,
  integer,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "client"]);
export const clientTypeEnum = pgEnum("client_type", ["company", "individual"]);
export const projectStatusEnum = pgEnum("project_status",
  ["draft", "active", "on_hold", "delivered", "cancelled"]);

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password"),
  totpSecret: text("totp_secret"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  backupCodes: jsonb("backup_codes").$type<string[]>(),
  role: userRoleEnum("role").notNull().default("client"),
  name: text("name"),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  socialLinks: jsonb("social_links").$type<{
    github?: string;
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  }>(),
  bannedAt: timestamp("banned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Sessions (NextAuth) ───────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Email Verifications ───────────────────────────────────────────────────────
export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Password Resets ───────────────────────────────────────────────────────────
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Agent Tasks ───────────────────────────────────────────────────────────────
export const agentTasks = pgTable("agent_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull().default("pending"),
  payload: json("payload"),
  result: json("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── TOTP Challenges ───────────────────────────────────────────────────────────
export const totpChallenges = pgTable("totp_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ── Agent Logs ────────────────────────────────────────────────────────────────
export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => agentTasks.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Clients ──────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: clientTypeEnum("type").notNull().default("company"),
  email: text("email"),
  phone: text("phone"),
  billingAddress: jsonb("billing_address"),
  notes: text("notes"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("clients_slug_unique").on(table.slug),
]);

// ── Client Contacts ──────────────────────────────────────────────────────────
export const clientContacts = pgTable("client_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("client_contacts_client_user_unique")
    .on(table.clientId, table.userId),
]);

// ── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: projectStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  startedAt: timestamp("started_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("projects_client_id_idx").on(table.clientId),
]);

// ── Types ────────────────────────────────────────────────────────────────────
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientContact = typeof clientContacts.$inferSelect;
export type NewClientContact = typeof clientContacts.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// ST6 enums
export const reportKindEnum = pgEnum("report_kind",
  ["delivery", "monthly", "audit", "other"]);
export const prestationKindEnum = pgEnum("prestation_kind",
  ["one_shot", "recurring"]);
export const billingModeEnum = pgEnum("billing_mode",
  ["stripe_auto", "manual_invoice"]);
export const maintenanceStatusEnum = pgEnum("maintenance_status",
  ["active", "past_due", "canceled"]);

// ── Prestations ─────────────────────────────────────────────────────────────
export const prestations = pgTable("prestations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  basePriceEurCents: integer("base_price_eur_cents").notNull().default(0),
  kind: prestationKindEnum("kind").notNull().default("one_shot"),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("prestations_slug_unique").on(table.slug),
  uniqueIndex("prestations_stripe_product_unique").on(table.stripeProductId),
  uniqueIndex("prestations_stripe_price_unique").on(table.stripePriceId),
]);

// Commercial enums
export const quoteStatusEnum = pgEnum("quote_status",
  ["draft", "sent", "accepted", "declined", "expired"]);
export const invoiceStatusEnum = pgEnum("invoice_status",
  ["draft", "sent", "paid", "overdue", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method",
  ["stripe_card", "bank_transfer", "other"]);

// Commercial tables
export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  number: text("number").notNull(),
  status: quoteStatusEnum("status").notNull().default("draft"),
  issuedAt: timestamp("issued_at"),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  totalEurCents: integer("total_eur_cents").notNull().default(0),
  vatRateBps: integer("vat_rate_bps").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("quotes_number_unique").on(table.number),
  index("quotes_client_id_idx").on(table.clientId),
]);

export const quoteItems = pgTable("quote_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  prestationId: uuid("prestation_id")
    .references(() => prestations.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceEurCents: integer("unit_price_eur_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  quoteId: uuid("quote_id")
    .references(() => quotes.id, { onDelete: "set null" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  number: text("number").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  issuedAt: timestamp("issued_at"),
  dueAt: timestamp("due_at"),
  paidAt: timestamp("paid_at"),
  totalEurCents: integer("total_eur_cents").notNull().default(0),
  vatRateBps: integer("vat_rate_bps").notNull().default(0),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("invoices_number_unique").on(table.number),
  uniqueIndex("invoices_stripe_pi_unique").on(table.stripePaymentIntentId),
  index("invoices_client_id_idx").on(table.clientId),
]);

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceEurCents: integer("unit_price_eur_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amountEurCents: integer("amount_eur_cents").notNull(),
  method: paymentMethodEnum("method").notNull(),
  externalRef: text("external_ref"),
  paidAt: timestamp("paid_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payments_invoice_id_idx").on(table.invoiceId),
]);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// ── Reports ─────────────────────────────────────────────────────────────────
export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: reportKindEnum("kind").notNull().default("delivery"),
  filePath: text("file_path").notNull(),
  summary: text("summary"),
  issuedAt: timestamp("issued_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("reports_client_id_idx").on(table.clientId),
]);

// ── Maintenance Contracts ───────────────────────────────────────────────────
export const maintenanceContracts = pgTable("maintenance_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  prestationId: uuid("prestation_id").notNull()
    .references(() => prestations.id, { onDelete: "restrict" }),
  billingMode: billingModeEnum("billing_mode").notNull(),
  status: maintenanceStatusEnum("status").notNull().default("active"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  monthlyPriceEurCents: integer("monthly_price_eur_cents").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  startedAt: timestamp("started_at").notNull(),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("maintenance_contracts_client_unique").on(table.clientId),
  uniqueIndex("maintenance_contracts_stripe_sub_unique")
    .on(table.stripeSubscriptionId),
]);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Prestation = typeof prestations.$inferSelect;
export type NewPrestation = typeof prestations.$inferInsert;
export type MaintenanceContract = typeof maintenanceContracts.$inferSelect;
export type NewMaintenanceContract = typeof maintenanceContracts.$inferInsert;
