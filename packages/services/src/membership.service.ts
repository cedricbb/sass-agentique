import { eq, and } from "drizzle-orm";
import { db, memberships, users } from "@saas/db";

export type MembershipResult = {
  id: string;
  userId: string;
  tenantId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  createdAt: Date;
};

export type MemberWithUser = MembershipResult & {
  email: string;
  name: string | null;
};

export async function addMember({
  userId,
  tenantId,
  role = "MEMBER",
}: {
  userId: string;
  tenantId: string;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}): Promise<MembershipResult> {
  // Vérifier si déjà membre
  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)),
    );

  if (existing.length > 0) {
    throw new Error("ALREADY_MEMBER");
  }

  const [membership] = await db
    .insert(memberships)
    .values({ userId, tenantId, role })
    .returning({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      role: memberships.role,
      createdAt: memberships.createdAt,
    });

  return membership;
}

export async function removeMember(
  membershipId: string,
  tenantId: string,
): Promise<void> {
  // Vérifier que le membership appartient bien à ce tenant (isolation cross-tenant)
  const [membership] = await db
    .select({ id: memberships.id, tenantId: memberships.tenantId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.id, membershipId));

  if (!membership || membership.tenantId !== tenantId) {
    throw new Error("FORBIDDEN");
  }

  if (membership.role === "OWNER") {
    throw new Error("CANNOT_REMOVE_OWNER");
  }

  await db.delete(memberships).where(eq(memberships.id, membershipId));
}

export async function updateMemberRole({
  membershipId,
  tenantId,
  role,
}: {
  membershipId: string;
  tenantId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}): Promise<MembershipResult> {
  // Vérifier isolation tenant
  const [existing] = await db
    .select({ id: memberships.id, tenantId: memberships.tenantId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.id, membershipId));

  if (!existing || existing.tenantId !== tenantId) {
    throw new Error("FORBIDDEN");
  }

  if (existing.role === "OWNER") {
    throw new Error("CANNOT_CHANGE_OWNER_ROLE");
  }

  const [updated] = await db
    .update(memberships)
    .set({ role, updatedAt: new Date() })
    .where(eq(memberships.id, membershipId))
    .returning({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      role: memberships.role,
      createdAt: memberships.createdAt,
    });

  return updated;
}

export async function getMembersByTenant(
  tenantId: string,
): Promise<MemberWithUser[]> {
  const results = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      role: memberships.role,
      createdAt: memberships.createdAt,
      email: users.email,
      name: users.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.tenantId, tenantId));

  return results;
}

export async function getUserRole(
  userId: string,
  tenantId: string,
): Promise<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | null> {
  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)),
    );

  return membership?.role ?? null;
}

export async function getMembershipByUser(
  userId: string,
  tenantId: string,
): Promise<MembershipResult | null> {
  const [membership] = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      role: memberships.role,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .where(
      and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)),
    );

  return membership ?? null;
}
