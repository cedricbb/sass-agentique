import { eq, desc, count, isNotNull, sql, ilike, or } from "drizzle-orm";
import { db } from "@saas/db";
import {
  users,
  agentTasks,
  agentLogs,
} from "@saas/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalAgentTasks: number;
  pendingAgentTasks: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  bannedAt: Date | null;
  totpEnabled: boolean;
  emailVerified: boolean;
  createdAt: Date;
};

export type AdminAgentTask = {
  id: string;
  agentType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminAgentLog = {
  id: string;
  taskId: string;
  level: string;
  message: string;
  createdAt: Date;
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalUsersRes,
    bannedUsersRes,
    totalAgentTasksRes,
    pendingAgentTasksRes,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(isNotNull(users.bannedAt)),
    db.select({ count: count() }).from(agentTasks),
    db
      .select({ count: count() })
      .from(agentTasks)
      .where(eq(agentTasks.status, "pending")),
  ]);

  const totalUsers = totalUsersRes[0]?.count ?? 0;
  const bannedUsers = bannedUsersRes[0]?.count ?? 0;

  return {
    totalUsers,
    activeUsers: totalUsers - bannedUsers,
    bannedUsers,
    totalAgentTasks: totalAgentTasksRes[0]?.count ?? 0,
    pendingAgentTasks: pendingAgentTasksRes[0]?.count ?? 0,
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export type ListUsersOptions = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listAdminUsers(
  options: ListUsersOptions = {},
): Promise<{ users: AdminUser[]; total: number }> {
  const { search, page = 1, pageSize = 20 } = options;
  const offset = (page - 1) * pageSize;

  const whereClause = search
    ? or(
        ilike(users.email, `%${search}%`),
        ilike(sql`coalesce(${users.name}, '')`, `%${search}%`),
      )
    : undefined;

  const [rows, totalRes] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        bannedAt: users.bannedAt,
        totpEnabled: users.totpEnabled,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(users)
      .where(whereClause),
  ]);

  return { users: rows, total: totalRes[0]?.count ?? 0 };
}

export async function banUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ bannedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function unbanUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ bannedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function resetUserTotp(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      totpSecret: null,
      totpEnabled: false,
      backupCodes: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// ── Agent Tasks ───────────────────────────────────────────────────────────────

export type ListAgentTasksOptions = {
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function listAdminAgentTasks(
  options: ListAgentTasksOptions = {},
): Promise<{ tasks: AdminAgentTask[]; total: number }> {
  const { status, page = 1, pageSize = 20 } = options;
  const offset = (page - 1) * pageSize;

  const whereClause = status ? eq(agentTasks.status, status) : undefined;

  const [rows, totalRes] = await Promise.all([
    db
      .select({
        id: agentTasks.id,
        agentType: agentTasks.agentType,
        status: agentTasks.status,
        createdAt: agentTasks.createdAt,
        updatedAt: agentTasks.updatedAt,
      })
      .from(agentTasks)
      .where(whereClause)
      .orderBy(desc(agentTasks.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(agentTasks).where(whereClause),
  ]);

  return {
    tasks: rows,
    total: totalRes[0]?.count ?? 0,
  };
}

export async function getAgentTaskLogs(taskId: string): Promise<AdminAgentLog[]> {
  return db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.taskId, taskId))
    .orderBy(agentLogs.createdAt);
}
