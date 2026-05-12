import { db, prestations, type Prestation, type NewPrestation } from "@saas/db";
import { eq, asc } from "drizzle-orm";
import { generateSlug } from "./utils/slug";

export type ListPrestationsOptions = {
  includeInactive?: boolean;
};
export type CreatePrestationInput = NewPrestation & { name: string };
export type UpdatePrestationPatch = Partial<NewPrestation>;

export async function listPrestations(
  opts?: ListPrestationsOptions,
): Promise<Prestation[]> {
  const includeInactive = opts?.includeInactive ?? false;
  return db
    .select()
    .from(prestations)
    .where(includeInactive ? undefined : eq(prestations.isActive, true))
    .orderBy(asc(prestations.sortOrder));
}

export async function getPrestationById(
  id: string,
): Promise<Prestation | null> {
  const rows = await db
    .select()
    .from(prestations)
    .where(eq(prestations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPrestationBySlug(
  slug: string,
): Promise<Prestation | null> {
  const rows = await db
    .select()
    .from(prestations)
    .where(eq(prestations.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPrestation(
  input: CreatePrestationInput,
): Promise<Prestation> {
  const slug = input.slug ?? generateSlug(input.name);
  const rows = await db
    .insert(prestations)
    .values({ ...input, slug })
    .returning();
  return rows[0];
}

export async function updatePrestation(
  id: string,
  patch: UpdatePrestationPatch,
): Promise<Prestation | null> {
  const rows = await db
    .update(prestations)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(prestations.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function archivePrestation(
  id: string,
): Promise<Prestation | null> {
  const rows = await db
    .update(prestations)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(prestations.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function unarchivePrestation(
  id: string,
): Promise<Prestation | null> {
  const rows = await db
    .update(prestations)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(prestations.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deletePrestation(id: string): Promise<void> {
  await db.delete(prestations).where(eq(prestations.id, id));
}
