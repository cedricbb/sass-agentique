import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, invitations, users } from "@saas/db";
import { getMembershipByUser, addMember } from "./membership.service";
import { getTenantById } from "./tenant.service";
import { sendInvitationEmail } from "./email.service";

const INVITATION_TTL_DAYS = 7;

export type InvitationResult = {
  id: string;
  tenantId: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  token: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
};

function invitationExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + INVITATION_TTL_DAYS);
  return d;
}

export async function inviteMember({
  tenantId,
  invitedBy,
  email,
  role = "MEMBER",
}: {
  tenantId: string;
  invitedBy: string;
  email: string;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}): Promise<InvitationResult> {
  const normalizedEmail = email.toLowerCase();

  // Vérifier si l'email correspond à un user déjà membre
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (existingUser) {
    const existingMembership = await getMembershipByUser(existingUser.id, tenantId);
    if (existingMembership) {
      throw new Error("ALREADY_MEMBER");
    }
  }

  // Vérifier si une invitation PENDING existe déjà
  const [existingInvitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.tenantId, tenantId),
        eq(invitations.email, normalizedEmail),
        eq(invitations.status, "PENDING"),
      ),
    );

  if (existingInvitation) {
    throw new Error("INVITATION_ALREADY_SENT");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = invitationExpiresAt();

  const [invitation] = await db
    .insert(invitations)
    .values({
      tenantId,
      email: normalizedEmail,
      role,
      token,
      status: "PENDING",
      invitedBy,
      expiresAt,
    })
    .returning({
      id: invitations.id,
      tenantId: invitations.tenantId,
      email: invitations.email,
      role: invitations.role,
      token: invitations.token,
      status: invitations.status,
      invitedBy: invitations.invitedBy,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    });

  // Récupérer le nom du tenant pour l'email
  const tenant = await getTenantById(tenantId);

  await sendInvitationEmail(
    normalizedEmail,
    token,
    tenant?.name ?? "votre espace",
  );

  return invitation as InvitationResult;
}

export async function acceptInvitation({
  token,
  userId,
}: {
  token: string;
  userId: string;
}): Promise<{ tenantSlug: string }> {
  const now = new Date();

  const [invitation] = await db
    .select({
      id: invitations.id,
      tenantId: invitations.tenantId,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(eq(invitations.token, token));

  if (!invitation) {
    throw new Error("INVALID_TOKEN");
  }

  if (invitation.expiresAt < now) {
    throw new Error("TOKEN_EXPIRED");
  }

  if (invitation.status !== "PENDING") {
    throw new Error("INVITATION_NOT_PENDING");
  }

  // Ajouter le membre
  await addMember({
    userId,
    tenantId: invitation.tenantId,
    role: invitation.role as "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
  });

  // Marquer l'invitation comme acceptée
  await db
    .update(invitations)
    .set({ status: "ACCEPTED", updatedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  // Récupérer le slug du tenant
  const tenant = await getTenantById(invitation.tenantId);

  return { tenantSlug: tenant!.slug };
}

export async function cancelInvitation(
  invitationId: string,
  tenantId: string,
): Promise<void> {
  const [invitation] = await db
    .select({ id: invitations.id, tenantId: invitations.tenantId })
    .from(invitations)
    .where(eq(invitations.id, invitationId));

  if (!invitation || invitation.tenantId !== tenantId) {
    throw new Error("FORBIDDEN");
  }

  await db
    .update(invitations)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(invitations.id, invitationId));
}

export async function getInvitationsByTenant(
  tenantId: string,
): Promise<InvitationResult[]> {
  const results = await db
    .select({
      id: invitations.id,
      tenantId: invitations.tenantId,
      email: invitations.email,
      role: invitations.role,
      token: invitations.token,
      status: invitations.status,
      invitedBy: invitations.invitedBy,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.tenantId, tenantId));

  return results as InvitationResult[];
}
