"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { validateSession, updateUserProfile, updateUserSocialLinks, changeUserPassword } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/schemas/profile.schemas";

export async function updateProfileAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  await updateUserProfile(user.id, {
    name: String(formData.get("name") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    location: String(formData.get("location") ?? ""),
    website: String(formData.get("website") ?? ""),
  });

  revalidatePath("/account/profile");
  revalidatePath("/admin/profile");

  return null;
}

export async function updateSocialLinksAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  await updateUserSocialLinks(user.id, {
    github: String(formData.get("github") ?? ""),
    linkedin: String(formData.get("linkedin") ?? ""),
    twitter: String(formData.get("twitter") ?? ""),
    instagram: String(formData.get("instagram") ?? ""),
  });

  revalidatePath("/admin/profile");

  return null;
}

export async function changeAdminPasswordAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const user = await requireAdmin();

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

  revalidatePath("/admin/profile");
  return null;
}
