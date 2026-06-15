"use server";

import { revalidatePath } from "next/cache";
import { createPrestationSchema, updatePrestationSchema } from "@/lib/schemas/prestation.schemas";
import {
  createPrestation,
  updatePrestation,
  archivePrestation,
  getPrestationById,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Prestation } from "@saas/db";

export async function createPrestationAction(
  input: unknown,
): Promise<ActionResult<Prestation>> {
  return withAdmin(async (user) => {
    const data = createPrestationSchema.parse(input);
    const payload: Record<string, unknown> = {
      name: data.name,
      basePriceEurCents: Math.round(data.basePriceEur * 100),
      kind: data.kind,
      ownerId: user.id,
    };
    if (data.slug !== undefined && data.slug.trim().length > 0) payload.slug = data.slug;
    if (data.description !== undefined) payload.description = data.description;
    const prestation = await createPrestation(payload as never);
    revalidatePath("/admin/prestations");
    return prestation;
  });
}

export async function updatePrestationAction(
  id: string,
  input: unknown,
): Promise<ActionResult<Prestation | null>> {
  return withAdmin(async () => {
    const data = updatePrestationSchema.parse(input);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.description !== undefined) patch.description = data.description;
    if (data.kind !== undefined) patch.kind = data.kind;
    if (data.basePriceEur !== undefined) {
      patch.basePriceEurCents = Math.round(data.basePriceEur * 100);
    }
    const prestation = await updatePrestation(id, patch);
    if (prestation === null) {
      throw new Error("PRESTATION_NOT_FOUND");
    }
    revalidatePath("/admin/prestations");
    revalidatePath(`/admin/prestations/${id}`);
    return prestation;
  });
}

export async function archivePrestationAction(
  id: string,
): Promise<ActionResult<Prestation>> {
  return withAdmin(async () => {
    const prestation = await archivePrestation(id);
    if (prestation === null) {
      throw new Error("PRESTATION_NOT_FOUND");
    }
    revalidatePath("/admin/prestations");
    return prestation;
  });
}

export async function getPrestationByIdAction(
  id: string,
): Promise<ActionResult<Prestation | null>> {
  return withAdmin(async () => {
    return getPrestationById(id);
  });
}
