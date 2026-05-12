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
