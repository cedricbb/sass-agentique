"use server";

import { revalidatePath } from "next/cache";
import { createClientSchema, updateClientSchema, inviteCustomerSchema } from "@/lib/schemas/client.schemas";
import {
  createClient,
  updateClient,
  deleteClient,
  getClientById,
  getClientContactWithUser,
  createInvitation,
} from "@saas/services";
import { withAdmin, ok, fail, handleActionError, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import type { Client } from "@saas/db";

function isNextRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as Error & { digest?: string }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}


export async function createClientAction(
  input: unknown,
): Promise<ActionResult<Client>> {
  return withAdmin(async (user) => {
    const parsed = createClientSchema.parse(input);
    const client = await createClient({ ...parsed, ownerId: user.id });
    revalidatePath("/admin/clients");
    return client;
  });
}

export async function updateClientAction(
  id: string,
  input: unknown,
): Promise<ActionResult<Client | null>> {
  return withAdmin(async () => {
    const parsed = updateClientSchema.parse(input);
    const client = await updateClient(id, parsed);
    revalidatePath("/admin/clients");
    return client;
  });
}

export async function deleteClientAction(
  id: string,
): Promise<ActionResult<void>> {
  return withAdmin(async () => {
    await deleteClient(id);
    revalidatePath("/admin/clients");
  });
}

export async function getClientByIdAction(
  id: string,
): Promise<ActionResult<Client | null>> {
  return withAdmin(async () => {
    return getClientById(id);
  });
}

export async function inviteCustomerAction(
  clientId: string,
  contactId: string,
): Promise<ActionResult<{ expiresAt: Date }>> {
  try {
    const adminUser = await requireAdmin();
    const parsed = inviteCustomerSchema.parse({ clientId, contactId });
    const contactWithUser = await getClientContactWithUser(parsed.contactId);
    if (!contactWithUser || contactWithUser.contact.clientId !== parsed.clientId) {
      return fail("INVALID_INPUT", "Contact introuvable ou accès refusé.", 400);
    }
    const result = await createInvitation({
      clientId: parsed.clientId,
      contactId: parsed.contactId,
      email: contactWithUser.user.email,
      invitedBy: adminUser.id,
    });
    revalidatePath(`/admin/clients/${parsed.clientId}`);
    return ok({ expiresAt: result.expiresAt });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return handleActionError(error);
  }
}
