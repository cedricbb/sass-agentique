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
  resendVerificationEmail,
  listTenantsByUser,
  acceptInvitation,
  validateSession,
  consumeTotpChallenge,
} from "@saas/services";

const SESSION_COOKIE = "session-token";
const TOTP_CHALLENGE_COOKIE = "totp-challenge";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours
const TOTP_CHALLENGE_MAX_AGE = 60 * 15; // 15 minutes

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

  let sessionToken: string;
  let tenantSlug: string;

  try {
    const result = await register({ email, password, name });
    sessionToken = result.sessionToken;
    tenantSlug = result.tenantSlug;
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_ALREADY_EXISTS") {
      return { error: "Cet email est déjà utilisé." };
    }
    return { error: "Une erreur est survenue. Réessayez." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  redirect(`/${tenantSlug}/dashboard`);
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  try {
    const result = await login({ email, password });
    const cookieStore = await cookies();

    if (result.requiresTotp) {
      cookieStore.set(TOTP_CHALLENGE_COOKIE, result.challengeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: TOTP_CHALLENGE_MAX_AGE,
        path: "/",
      });
      const verifyUrl = next ? `/verify-2fa?next=${encodeURIComponent(next)}` : "/verify-2fa";
      redirect(verifyUrl);
    }

    cookieStore.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    if (next.startsWith("/")) {
      redirect(next);
    }

    const tenantList = await listTenantsByUser(result.userId);
    const destination = tenantList[0]?.slug ? `/${tenantList[0].slug}/dashboard` : "/onboarding";
    redirect(destination);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
      return { error: "Email ou mot de passe incorrect." };
    }
    throw err;
  }
}

// ── Verify 2FA ────────────────────────────────────────────────────────────────

export async function totpVerifyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get("code") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  if (!code) {
    return { error: "Code requis." };
  }

  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(TOTP_CHALLENGE_COOKIE)?.value;

  if (!challengeToken) {
    redirect("/login");
  }

  let destination: string;

  try {
    const result = await consumeTotpChallenge(challengeToken, code);

    cookieStore.delete(TOTP_CHALLENGE_COOKIE);
    cookieStore.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    destination = next.startsWith("/")
      ? next
      : result.tenantSlug
        ? `/${result.tenantSlug}/dashboard`
        : "/onboarding";
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CHALLENGE_EXPIRED") {
        redirect("/login?error=session-expired");
      }
      if (err.message === "INVALID_TOTP_CODE") {
        return { error: "Code invalide. Réessayez." };
      }
    }
    return { error: "Une erreur est survenue. Réessayez." };
  }

  // redirect() doit être hors du try/catch — il lance une erreur spéciale
  // que le catch attraperait sinon
  redirect(destination);
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

// ── Accept invitation ─────────────────────────────────────────────────────────

export async function acceptInvitationAction(token: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const user = await validateSession(sessionToken);
  if (!user) {
    redirect("/login");
  }

  let tenantSlug: string;
  try {
    const result = await acceptInvitation({ token, userId: user.id });
    tenantSlug = result.tenantSlug;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INVALID_TOKEN")
        redirect("/login?error=invalid-invitation");
      if (err.message === "TOKEN_EXPIRED")
        redirect("/login?error=expired-invitation");
      if (err.message === "INVITATION_NOT_PENDING")
        redirect("/login?error=invitation-used");
    }
    redirect("/login?error=unknown");
  }

  redirect(`/${tenantSlug}/dashboard`);
}

// ── Resend verification email ─────────────────────────────────────────────────

export async function resendVerificationEmailAction(): Promise<ActionState> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return { error: "Non authentifié." };

  const user = await validateSession(sessionToken);
  if (!user) return { error: "Non authentifié." };

  try {
    await resendVerificationEmail(user.id);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return { error: "Utilisateur introuvable." };
    }
    return { error: "Une erreur est survenue. Réessayez." };
  }
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
