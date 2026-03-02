import { eq } from "drizzle-orm";
import { db, tenants, memberships } from "@saas/db";

export type TenantResult = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  createdAt: Date;
};

export function generateSlug(nameOrEmail: string): string {
  // Si c'est un email, prendre la partie avant @
  const base = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;

  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")  // supprimer chars spéciaux sauf espaces et tirets
    .replace(/\s+/g, "-")           // espaces → tirets
    .replace(/-+/g, "-")            // tirets multiples → un seul
    .replace(/^-|-$/g, "")          // supprimer tirets en début/fin
    .slice(0, 50);                  // max 50 chars
}

export async function createTenant({
  name,
  slug,
}: {
  name: string;
  slug: string;
}): Promise<TenantResult> {
  // Vérifier si le slug est déjà pris
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug));

  if (existing.length > 0) {
    throw new Error("SLUG_ALREADY_EXISTS");
  }

  const [tenant] = await db
    .insert(tenants)
    .values({ name, slug })
    .returning({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
    });

  return tenant;
}

export async function getTenantBySlug(
  slug: string,
): Promise<TenantResult | null> {
  const [tenant] = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug));

  return tenant ?? null;
}

export async function getTenantById(
  tenantId: string,
): Promise<TenantResult | null> {
  const [tenant] = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  return tenant ?? null;
}

export async function listTenantsByUser(
  userId: string,
): Promise<TenantResult[]> {
  const results = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .innerJoin(memberships, eq(memberships.tenantId, tenants.id))
    .where(eq(memberships.userId, userId));

  return results;
}

export async function updateTenant({
  tenantId,
  name,
}: {
  tenantId: string;
  name: string;
}): Promise<TenantResult> {
  const [tenant] = await db
    .update(tenants)
    .set({ name, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
    });

  if (!tenant) {
    throw new Error("TENANT_NOT_FOUND");
  }

  return tenant;
}
