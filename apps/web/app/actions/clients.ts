"use server";

import { revalidatePath } from "next/cache";
import { createClientSchema, updateClientSchema } from "@/lib/schemas/client.schemas";
import {
  createClient,
  updateClient,
  deleteClient,
  getClientById,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Client } from "@saas/db";


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
