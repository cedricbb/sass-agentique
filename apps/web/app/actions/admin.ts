"use server";

import { revalidatePath } from "next/cache";
import { banUser, unbanUser, resetUserTotp } from "@saas/services";
import { withAdmin } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";

export async function banUserAction(userId: string): Promise<ActionResult<void>> {
  return withAdmin(async () => {
    await banUser(userId);
    revalidatePath("/admin/users");
  });
}

export async function unbanUserAction(userId: string): Promise<ActionResult<void>> {
  return withAdmin(async () => {
    await unbanUser(userId);
    revalidatePath("/admin/users");
  });
}

export async function resetUserTotpAction(userId: string): Promise<ActionResult<void>> {
  return withAdmin(async () => {
    await resetUserTotp(userId);
    revalidatePath("/admin/users");
  });
}
