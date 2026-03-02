import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  json,
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
  role: text("role").notNull().default("user"),
  name: text("name"),
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
