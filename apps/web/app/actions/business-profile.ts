"use server";

import { revalidatePath } from "next/cache";
import {
  upsertBusinessProfile,
  getBusinessProfile,
  setBusinessProfileLogoKey,
  type UpsertBusinessProfileInput,
} from "@saas/services";
import type { BusinessProfile } from "@saas/db";
import { businessProfileSchema, type BusinessProfileFormValues } from "@/lib/schemas/business-profile.schemas";
import { withAdmin, ok, fail, handleActionError, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import {
  detectImageFormat,
  imageContentType,
  assertImageSize,
  buildLogoKey,
  uploadImageToR2,
  deletePdfFromR2,
  FileTooLargeError,
} from "@/lib/storage/r2";

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

export async function uploadBusinessProfileLogoAction(formData: FormData): Promise<ActionResult<BusinessProfile>> {
  try {
    const user = await requireAdmin();
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0)
      return fail("FILE_REQUIRED", "Un fichier image est requis.", 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const format = detectImageFormat(buffer);
    if (format === null)
      return fail("INVALID_IMAGE", "Le logo doit être un PNG ou un JPEG.", 400);
    try { assertImageSize(buffer); }
    catch (e) { if (e instanceof FileTooLargeError) return fail("FILE_TOO_LARGE", e.message, 400); throw e; }
    const key = buildLogoKey(user.id);
    await uploadImageToR2(key, buffer, imageContentType(format));
    const profile = await setBusinessProfileLogoKey(user.id, key);
    if (profile === null) {
      try { await deletePdfFromR2(key); } catch (err) { console.error("[uploadBusinessProfileLogoAction] rollback R2 failed", key, err); }
      return fail("BUSINESS_PROFILE_REQUIRED", "Configurez votre profil entreprise avant d'ajouter un logo.", 400);
    }
    revalidatePath("/admin/settings/business-profile");
    return ok(profile);
  } catch (error) { return handleActionError(error); }
}

export async function removeBusinessProfileLogoAction(): Promise<ActionResult<BusinessProfile | null>> {
  try {
    const user = await requireAdmin();
    const profile = await getBusinessProfile(user.id);
    if (!profile || profile.logoKey === null) return ok(profile ?? null);
    try { await deletePdfFromR2(profile.logoKey); }
    catch (err) { console.error("[removeBusinessProfileLogoAction] R2 cleanup failed", profile.logoKey, err); }
    const updated = await setBusinessProfileLogoKey(user.id, null);
    revalidatePath("/admin/settings/business-profile");
    return ok(updated);
  } catch (error) { return handleActionError(error); }
}
