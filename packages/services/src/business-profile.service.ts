import { db, businessProfiles, type BusinessProfile } from "@saas/db";
import { eq } from "drizzle-orm";
import { type PostalAddress } from "./billing-party.shared";

export type UpsertBusinessProfileInput = {
  name: string
  legalForm?: string | null
  siret?: string | null
  tvaIntra?: string | null
  address?: PostalAddress | null
  email?: string | null
  phone?: string | null
  iban?: string | null
  bic?: string | null
  logoKey?: string | null
}

export async function getBusinessProfile(ownerId: string): Promise<BusinessProfile | null> {
  const [row] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.ownerId, ownerId))
    .limit(1);
  return row ?? null;
}

export async function setBusinessProfileLogoKey(
  ownerId: string,
  logoKey: string | null,
): Promise<BusinessProfile | null> {
  const [row] = await db
    .update(businessProfiles)
    .set({ logoKey, updatedAt: new Date() })
    .where(eq(businessProfiles.ownerId, ownerId))
    .returning();
  return row ?? null;
}

export async function upsertBusinessProfile(
  ownerId: string,
  input: UpsertBusinessProfileInput,
): Promise<BusinessProfile> {
  const [row] = await db
    .insert(businessProfiles)
    .values({ ownerId, ...input })
    .onConflictDoUpdate({
      target: businessProfiles.ownerId,
      set: {
        name: input.name,
        legalForm: input.legalForm,
        siret: input.siret,
        tvaIntra: input.tvaIntra,
        address: input.address,
        email: input.email,
        phone: input.phone,
        iban: input.iban,
        bic: input.bic,
        logoKey: input.logoKey,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
