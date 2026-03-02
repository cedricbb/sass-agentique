"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "@saas/services";

const SESSION_COOKIE = "session-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

type ActionState = { error: string } | { success: true } | null;

// ── Register ──────────────────────────────────────────────────────────────────

export async function registerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || undefined;

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  try {
    const { sessionToken } = await register({ email, password, name });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_ALREADY_EXISTS") {
      return { error: "Cet email est déjà utilisé." };
    }
    return { error: "Une erreur est survenue. Réessayez." };
  }

  redirect("/dashboard");
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  try {
    const { sessionToken } = await login({ email, password });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
      return { error: "Email ou mot de passe incorrect." };
    }
    return { error: "Une erreur est survenue. Réessayez." };
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await logout(sessionToken);
    cookieStore.delete(SESSION_COOKIE);
  }

  redirect("/login");
}

// ── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Email requis." };
  }

  try {
    await forgotPassword(email);
  } catch {
    // Fail silently — ne pas révéler si l'email existe
  }

  return { success: true };
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) {
    return { error: "Token manquant." };
  }

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  if (password !== confirm) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  try {
    await resetPassword(token, password);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVALID_TOKEN") return { error: "Lien invalide." };
      if (err.message === "TOKEN_EXPIRED") return { error: "Lien expiré. Recommencez." };
    }
    return { error: "Une erreur est survenue." };
  }

  redirect("/login?reset=success");
}

// ── Verify email ──────────────────────────────────────────────────────────────

export async function verifyEmailAction(
  token: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await verifyEmail(token);
    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVALID_TOKEN") return { error: "Lien invalide." };
      if (err.message === "TOKEN_EXPIRED") return { error: "Lien expiré. Réinscrivez-vous." };
    }
    return { error: "Une erreur est survenue." };
  }
}
