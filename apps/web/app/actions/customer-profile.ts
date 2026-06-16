"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { changeUserPassword, validateSession } from "@saas/services";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { changePasswordSchema } from "@/lib/schemas/profile.schemas";

export async function changeCustomerPasswordAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  let parsed: { oldPassword: string; newPassword: string; confirmNewPassword: string };
  try {
    parsed = changePasswordSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.errors[0].message };
    }
    throw err;
  }

  try {
    await changeUserPassword(user.id, parsed.oldPassword, parsed.newPassword);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_PASSWORD") {
      return { error: "Mot de passe actuel incorrect" };
    }
    throw err;
  }

  revalidatePath("/account/profile");
  return null;
}
