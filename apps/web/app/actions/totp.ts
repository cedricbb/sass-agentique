"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  enableTotp,
  disableTotp,
  regenerateBackupCodes,
  validateSession,
} from "@saas/services";

const SESSION_COOKIE = "session-token";

type ActionState = { error: string } | { success: true; backupCodes?: string[] } | null;

// ── Confirm TOTP setup ────────────────────────────────────────────────────────

export async function confirmTotpSetupAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const secret = String(formData.get("secret") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!secret || !code) {
    return { error: "Secret et code requis." };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  try {
    const { backupCodes } = await enableTotp(user.id, secret, code);
    return { success: true, backupCodes };
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TOTP_CODE") {
      return { error: "Code invalide. Vérifiez votre application d'authentification." };
    }
    return { error: "Une erreur est survenue." };
  }
}

// ── Disable TOTP ──────────────────────────────────────────────────────────────

export async function disableTotpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get("code") ?? "").trim();
  const tenantSlug = String(formData.get("tenantSlug") ?? "");

  if (!code) {
    return { error: "Code requis." };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  try {
    await disableTotp(user.id, code);
    revalidatePath(`/${tenantSlug}/settings/security`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVALID_CODE") {
        return { error: "Code invalide." };
      }
      if (err.message === "TOTP_NOT_ENABLED") {
        return { error: "Le 2FA n'est pas activé sur ce compte." };
      }
    }
    return { error: "Une erreur est survenue." };
  }
}

// ── Regenerate backup codes ───────────────────────────────────────────────────

export async function regenerateBackupCodesAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  try {
    const backupCodes = await regenerateBackupCodes(user.id);
    return { success: true, backupCodes };
  } catch {
    return { error: "Une erreur est survenue." };
  }
}
