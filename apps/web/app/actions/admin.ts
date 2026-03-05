"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  validateSession,
  banUser,
  unbanUser,
  resetUserTotp,
  changeTenantPlan,
} from "@saas/services";

const SESSION_COOKIE = "session-token";

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");
  if (user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function banUserAction(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await banUser(userId);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { error: "Accès refusé." };
    }
    return { error: "Une erreur est survenue." };
  }
}

export async function unbanUserAction(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await unbanUser(userId);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { error: "Accès refusé." };
    }
    return { error: "Une erreur est survenue." };
  }
}

export async function resetUserTotpAction(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await resetUserTotp(userId);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { error: "Accès refusé." };
    }
    return { error: "Une erreur est survenue." };
  }
}

export async function changeTenantPlanAction(
  tenantId: string,
  plan: string,
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const validPlans = ["free", "pro", "business"];
    if (!validPlans.includes(plan)) {
      return { error: "Plan invalide." };
    }
    await changeTenantPlan(tenantId, plan);
    revalidatePath("/admin/tenants");
    return {};
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return { error: "Accès refusé." };
    }
    return { error: "Une erreur est survenue." };
  }
}
