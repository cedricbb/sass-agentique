import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  json,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const membershipRoleEnum = pgEnum("membership_role", [
  "OWNER",
  "ADMIN",
  "MEMBER",
  "VIEWER",
]);

// ── Tenants ───────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password"),
  totpSecret: text("totp_secret"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  backupCodes: jsonb("backup_codes").$type<string[]>(),
  role: text("role").notNull().default("user"),
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

// ── Memberships ───────────────────────────────────────────────────────────────
export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  role: membershipRoleEnum("role").notNull().default("MEMBER"),
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

// ── Invitations ───────────────────────────────────────────────────────────────
export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "CANCELLED",
]);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: membershipRoleEnum("role").notNull().default("MEMBER"),
  token: text("token").notNull().unique(),
  status: invitationStatusEnum("status").notNull().default("PENDING"),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Agent Tasks ───────────────────────────────────────────────────────────────
export const agentTasks = pgTable("agent_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
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

// ── Billing ───────────────────────────────────────────────────────────────────

interface PlanFeaturesJson {
  maxMembers: number;
  maxContacts: number;
  maxAgentTasksPerMonth: number;
  maxEmailsPerMonth: number;
  storageMb: number;
  maxActiveWorkflows: number;
  hasTwoFactor: boolean;
  hasAdminBackoffice: boolean;
  hasAiAgents: boolean;
  hasWorkflows: boolean;
  hasCustomDomain: boolean;
  hasWhiteLabel: boolean;
  hasAdvancedAnalytics: boolean;
  hasPrioritySupport: boolean;
  hasSla: boolean;
  hasDataExport: boolean;
}

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
]);

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  stripeProductId: text("stripe_product_id").unique(),
  stripePriceIdMonthly: text("stripe_price_id_monthly").unique(),
  stripePriceIdYearly: text("stripe_price_id_yearly").unique(),
  priceMonthlyEurCents: integer("price_monthly_eur_cents").notNull().default(0),
  priceYearlyEurCents: integer("price_yearly_eur_cents").notNull().default(0),
  features: jsonb("features").notNull().$type<PlanFeaturesJson>(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_tenant_id_idx").on(table.tenantId),
    uniqueIndex("subscriptions_stripe_sub_id_unique").on(table.stripeSubscriptionId),
  ]
);

export type SubscriptionStatus = typeof subscriptionStatusEnum.enumValues[number];
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
