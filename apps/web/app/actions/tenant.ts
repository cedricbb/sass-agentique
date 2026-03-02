"use server";

import { inviteMember, removeMember, cancelInvitation } from "@saas/services";

export async function inviteMemberAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const invitedBy = String(formData.get("invitedBy") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const role =
    (formData.get("role") as "ADMIN" | "MEMBER" | "VIEWER") ?? "MEMBER";

  if (!email || !tenantId || !invitedBy) return;

  try {
    await inviteMember({ tenantId, invitedBy, email, role });
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
    await cancelInvitation(invitationId, tenantId);
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      console.error("[cancelInvitationAction] FORBIDDEN");
    }
  }
}
