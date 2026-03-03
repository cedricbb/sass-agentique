"use server";

import { cookies } from "next/headers";
import { inviteMember, removeMember, cancelInvitation, validateSession, getUserRole } from "@saas/services";
import type { SessionUser } from "@saas/services";
import { createAbility } from "@saas/permissions";
import type { AppAbility } from "@saas/permissions";

const SESSION_COOKIE = "session-token";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getActorAbility(tenantId: string): Promise<{ user: SessionUser; ability: AppAbility }> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) throw new Error("UNAUTHORIZED");

  const user = await validateSession(sessionToken);
  if (!user) throw new Error("UNAUTHORIZED");

  const role = await getUserRole(user.id, tenantId);
  if (!role) throw new Error("FORBIDDEN");

  return { user, ability: createAbility(role) };
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function inviteMemberAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const role =
    (formData.get("role") as "ADMIN" | "MEMBER" | "VIEWER") ?? "MEMBER";

  if (!email || !tenantId) return;

  try {
    const { user, ability } = await getActorAbility(tenantId);
    if (ability.cannot("invite", "Member")) throw new Error("FORBIDDEN");
    await inviteMember({ tenantId, invitedBy: user.id, email, role });
  } catch (err) {
    if (err instanceof Error) {
      console.error("[inviteMemberAction]", err.message);
    }
  }
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const membershipId = String(formData.get("membershipId") ?? "");
  const tenantId = String(formData.get("tenantId") ?? "");

  if (!membershipId || !tenantId) return;

  try {
    const { ability } = await getActorAbility(tenantId);
    if (ability.cannot("remove", "Member")) throw new Error("FORBIDDEN");
    await removeMember(membershipId, tenantId);
  } catch (err) {
    if (err instanceof Error) {
      console.error("[removeMemberAction]", err.message);
    }
  }
}

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  const invitationId = String(formData.get("invitationId") ?? "");
  const tenantId = String(formData.get("tenantId") ?? "");

  if (!invitationId || !tenantId) return;

  try {
    const { ability } = await getActorAbility(tenantId);
    if (ability.cannot("cancel", "Invitation")) throw new Error("FORBIDDEN");
    await cancelInvitation(invitationId, tenantId);
  } catch (err) {
    if (err instanceof Error) {
      console.error("[cancelInvitationAction]", err.message);
    }
  }
}
