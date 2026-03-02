"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, generateSlug, getTenantBySlug } from "@saas/services";
import { db, tenants, memberships } from "@saas/db";

const SESSION_COOKIE = "session-token";

export async function createWorkspaceAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length < 2) {
    redirect("/onboarding?error=name");
  }

  // Générer un slug unique
  const baseSlug = generateSlug(name);
  let finalSlug = baseSlug;
  for (let attempt = 1; attempt <= 10; attempt++) {
    const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${attempt - 1}`;
    const existing = await getTenantBySlug(candidate);
    if (!existing) {
      finalSlug = candidate;
      break;
    }
  }

  // Transaction : créer tenant + membership OWNER
  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name, slug: finalSlug })
      .returning({ id: tenants.id });

    await tx.insert(memberships).values({
      userId: user.id,
      tenantId: tenant.id,
      role: "OWNER",
    });
  });

  redirect(`/${finalSlug}/dashboard`);
}
