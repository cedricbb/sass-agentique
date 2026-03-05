import { eq, desc, count, isNotNull, sql, ilike, or } from "drizzle-orm";
import { db } from "@saas/db";
import {
  users,
  tenants,
  memberships,
  agentTasks,
  agentLogs,
} from "@saas/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalTenants: number;
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

export type AdminTenant = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  memberCount: number;
  createdAt: Date;
};

export type AdminAgentTask = {
  id: string;
  tenantId: string;
  tenantName: string;
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

// ── Tenant Stats ──────────────────────────────────────────────────────────────

export type TenantStats = {
  memberCount: number;
  agentTaskCount: number;
};

export async function getTenantStats(tenantId: string): Promise<TenantStats> {
  const [membersRes, tasksRes] = await Promise.all([
    db.select({ count: count() }).from(memberships).where(eq(memberships.tenantId, tenantId)),
    db.select({ count: count() }).from(agentTasks).where(eq(agentTasks.tenantId, tenantId)),
  ]);

  return {
    memberCount: membersRes[0]?.count ?? 0,
    agentTaskCount: tasksRes[0]?.count ?? 0,
  };
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalUsersRes,
    bannedUsersRes,
    totalTenantsRes,
    totalAgentTasksRes,
    pendingAgentTasksRes,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(isNotNull(users.bannedAt)),
    db.select({ count: count() }).from(tenants),
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
    totalTenants: totalTenantsRes[0]?.count ?? 0,
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

// ── Tenants ───────────────────────────────────────────────────────────────────

export type ListTenantsOptions = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listAdminTenants(
  options: ListTenantsOptions = {},
): Promise<{ tenants: AdminTenant[]; total: number }> {
  const { search, page = 1, pageSize = 20 } = options;
  const offset = (page - 1) * pageSize;

  const whereClause = search
    ? or(
        ilike(tenants.name, `%${search}%`),
        ilike(tenants.slug, `%${search}%`),
      )
    : undefined;

  const [rows, totalRes] = await Promise.all([
    db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        plan: tenants.plan,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(whereClause)
      .orderBy(desc(tenants.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(tenants).where(whereClause),
  ]);

  // Charger le count de membres pour chaque tenant
  const tenantIds = rows.map((r) => r.id);
  const memberCounts =
    tenantIds.length > 0
      ? await db
          .select({
            tenantId: memberships.tenantId,
            count: count(),
          })
          .from(memberships)
          .where(
            sql`${memberships.tenantId} = ANY(${sql.raw(
              `ARRAY[${tenantIds.map((id) => `'${id}'`).join(",")}]::uuid[]`,
            )})`,
          )
          .groupBy(memberships.tenantId)
      : [];

  const memberCountMap = new Map(memberCounts.map((r) => [r.tenantId, r.count]));

  return {
    tenants: rows.map((t) => ({
      ...t,
      memberCount: memberCountMap.get(t.id) ?? 0,
    })),
    total: totalRes[0]?.count ?? 0,
  };
}

export async function changeTenantPlan(
  tenantId: string,
  plan: string,
): Promise<void> {
  await db
    .update(tenants)
    .set({ plan, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
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
        tenantId: agentTasks.tenantId,
        tenantName: tenants.name,
        agentType: agentTasks.agentType,
        status: agentTasks.status,
        createdAt: agentTasks.createdAt,
        updatedAt: agentTasks.updatedAt,
      })
      .from(agentTasks)
      .leftJoin(tenants, eq(agentTasks.tenantId, tenants.id))
      .where(whereClause)
      .orderBy(desc(agentTasks.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(agentTasks).where(whereClause),
  ]);

  return {
    tasks: rows.map((r) => ({
      ...r,
      tenantName: r.tenantName ?? "—",
    })),
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
