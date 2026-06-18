"use server";

import { revalidatePath } from "next/cache";
import { upsertBusinessProfile, type UpsertBusinessProfileInput } from "@saas/services";
import type { BusinessProfile } from "@saas/db";
import { businessProfileSchema, type BusinessProfileFormValues } from "@/lib/schemas/business-profile.schemas";
import { withAdmin, type ActionResult } from "@/lib/action-result";

function mapFormValuesToUpsertInput(data: BusinessProfileFormValues): UpsertBusinessProfileInput {
  return {
    name: data.name,
    legalForm: data.legalForm,
    phone: data.phone,
    address: data.address,
    siret: data.siret === "" ? undefined : data.siret,
    tvaIntra: data.tvaIntra === "" ? undefined : data.tvaIntra,
    email: data.email === "" ? undefined : data.email,
    iban: data.iban === "" ? undefined : data.iban,
    bic: data.bic === "" ? undefined : data.bic,
  };
}

export async function upsertBusinessProfileAction(input: unknown): Promise<ActionResult<BusinessProfile>> {
  return withAdmin(async (user) => {
    const data = businessProfileSchema.parse(input);
    const mapped = mapFormValuesToUpsertInput(data);
    const profile = await upsertBusinessProfile(user.id, mapped);
    revalidatePath("/admin/settings/business-profile");
    return profile;
  });
}
