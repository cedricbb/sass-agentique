"use server";

import { revalidatePath } from "next/cache";
import { banUser, unbanUser, resetUserTotp } from "@saas/services";
import { requireAdmin } from "@/lib/auth";

export async function banUserAction(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await banUser(userId);
    revalidatePath("/admin/users");
    return {};
  } catch {
    return { error: "Une erreur est survenue." };
  }
}

export async function unbanUserAction(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await unbanUser(userId);
    revalidatePath("/admin/users");
    return {};
  } catch {
    return { error: "Une erreur est survenue." };
  }
}

export async function resetUserTotpAction(userId: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await resetUserTotp(userId);
    revalidatePath("/admin/users");
    return {};
  } catch {
    return { error: "Une erreur est survenue." };
  }
}

