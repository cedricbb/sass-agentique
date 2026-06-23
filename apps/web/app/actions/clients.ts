"use server";

import { revalidatePath } from "next/cache";
import { createClientSchema, updateClientSchema, inviteCustomerSchema, addClientContactSchema, updateClientContactSchema } from "@/lib/schemas/client.schemas";
import {
  createClient,
  updateClient,
  archiveClient,
  getClientById,
  listClientContacts,
  addClientContact,
  updateClientContact,
  deleteClientContact,
  createInvitation,
  setPrimaryContact,
} from "@saas/services";
import { withAdmin, ok, fail, handleActionError, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import type { Client, ClientContact } from "@saas/db";

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
    await archiveClient(id);
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
    const contacts = await listClientContacts(parsed.clientId);
    const contact = contacts.find((c) => c.id === parsed.contactId);
    if (!contact) {
      return fail("INVALID_INPUT", "Contact introuvable ou accès refusé.", 400);
    }
    const result = await createInvitation({
      clientId: parsed.clientId,
      contactId: parsed.contactId,
      email: contact.email,
      invitedBy: adminUser.id,
    });
    revalidatePath(`/admin/clients/${parsed.clientId}`);
    return ok({ expiresAt: result.expiresAt });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return handleActionError(error);
  }
}

export async function addClientContactAction(
  input: unknown,
): Promise<ActionResult<ClientContact>> {
  try {
    await requireAdmin();
    const parsed = addClientContactSchema.parse(input);
    const client = await getClientById(parsed.clientId);
    if (!client) {
      return fail("CLIENT_NOT_FOUND", "Client introuvable.", 404);
    }
    const existingContacts = await listClientContacts(parsed.clientId);
    const hasDuplicate = existingContacts.some(
      (c) => c.email.toLowerCase() === parsed.email.toLowerCase(),
    );
    if (hasDuplicate) {
      return fail("EMAIL_ALREADY_EXISTS", "Un contact avec cet email existe déjà.", 409);
    }
    const result = await addClientContact({ ...parsed, userId: null });
    revalidatePath(`/admin/clients/${parsed.clientId}`);
    return ok(result);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return handleActionError(error);
  }
}

export async function updateClientContactAction(
  contactId: string,
  clientId: string,
  input: unknown,
): Promise<ActionResult<ClientContact | null>> {
  try {
    await requireAdmin();
    const parsed = updateClientContactSchema.parse(input);
    if (parsed.email !== undefined) {
      const contacts = await listClientContacts(clientId);
      const duplicate = contacts.find(
        (c) => c.id !== contactId && c.email.toLowerCase() === parsed.email!.toLowerCase(),
      );
      if (duplicate) {
        return fail("EMAIL_ALREADY_EXISTS", "Un contact avec cet email existe déjà.", 409);
      }
    }
    const result = await updateClientContact(contactId, parsed);
    revalidatePath(`/admin/clients/${clientId}`);
    return ok(result);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return handleActionError(error);
  }
}

export async function deleteClientContactAction(
  contactId: string,
  clientId: string,
): Promise<ActionResult<void>> {
  try {
    await requireAdmin();
    await deleteClientContact(contactId);
    revalidatePath(`/admin/clients/${clientId}`);
    return ok(undefined);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return handleActionError(error);
  }
}

export async function setPrimaryClientContactAction(
  contactId: string,
  clientId: string,
): Promise<ActionResult<ClientContact | null>> {
  try {
    await requireAdmin();
    const result = await setPrimaryContact(clientId, contactId);
    if (result === null) {
      return fail("CONTACT_NOT_FOUND", "Contact introuvable ou n'appartient pas à ce client.", 404);
    }
    revalidatePath(`/admin/clients/${clientId}`);
    return ok(result);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return handleActionError(error);
  }
}
