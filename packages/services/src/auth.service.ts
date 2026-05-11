import { eq } from "drizzle-orm";
import { db } from "@saas/db";
import {
  users,
  sessions,
  emailVerifications,
  passwordResets,
} from "@saas/db";
import { createTotpChallenge } from "./totp.service";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email.service";
import { generateSlug } from "./utils/slug";

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_DAYS = 30;
const EMAIL_VERIFY_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function sessionExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d;
}

// ── Register ──────────────────────────────────────────────────────────────────

export type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

export type AuthResult = {
  sessionToken: string;
  userId: string;
  tenantSlug: string;
};

export async function register(input: RegisterInput): Promise<AuthResult> {
  const { email, password, name } = input;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (existing.length > 0) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      hashedPassword,
      name: name ?? null,
    })
    .returning({ id: users.id, email: users.email });

  // Créer la session en priorité — doit exister avant toute redirection
  const sessionToken = generateToken();

  await db.insert(sessions).values({
    userId: user.id,
    sessionToken,
    expires: sessionExpiresAt(),
  });

  const tenantSlug = generateSlug(name ?? email.split("@")[0]);

  // Envoyer l'email de vérification (échec = non bloquant)
  const verificationToken = generateToken();
  const verificationExpires = new Date();
  verificationExpires.setHours(
    verificationExpires.getHours() + EMAIL_VERIFY_TTL_HOURS,
  );

  await db.insert(emailVerifications).values({
    userId: user.id,
    token: verificationToken,
    expiresAt: verificationExpires,
  });

  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (err) {
    console.error("[auth.service] sendVerificationEmail failed:", err);
  }

  return { sessionToken, userId: user.id, tenantSlug };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult =
  | { requiresTotp: false; sessionToken: string; userId: string; tenantSlug: string }
  | { requiresTotp: true; challengeToken: string };

export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  const [user] = await db
    .select({
      id: users.id,
      hashedPassword: users.hashedPassword,
      totpEnabled: users.totpEnabled,
      name: users.name,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user || !user.hashedPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Si 2FA activé → créer un challenge et rediriger vers /verify-2fa
  if (user.totpEnabled) {
    const challengeToken = await createTotpChallenge(user.id);
    return { requiresTotp: true, challengeToken };
  }

  const sessionToken = generateToken();

  await db.insert(sessions).values({
    userId: user.id,
    sessionToken,
    expires: sessionExpiresAt(),
  });

  const tenantSlug = generateSlug(user.name ?? email.split("@")[0]);

  return { requiresTotp: false, sessionToken, userId: user.id, tenantSlug };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(sessionToken: string): Promise<void> {
  await db
    .delete(sessions)
    .where(eq(sessions.sessionToken, sessionToken));
}

// ── Validate session ──────────────────────────────────────────────────────────

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
  bio: string | null;
  location: string | null;
  website: string | null;
  socialLinks: { github?: string; linkedin?: string; twitter?: string; instagram?: string } | null;
};

export async function validateSession(
  sessionToken: string,
): Promise<SessionUser | null> {
  const now = new Date();

  const result = await db
    .select({
      userId: sessions.userId,
      expires: sessions.expires,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerified: users.emailVerified,
      bio: users.bio,
      location: users.location,
      website: users.website,
      socialLinks: users.socialLinks,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.sessionToken, sessionToken));

  if (result.length === 0) return null;

  const { expires, userId, email, name, role, emailVerified, bio, location, website, socialLinks } = result[0];

  if (expires < now) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    return null;
  }

  return { id: userId, email, name, role, emailVerified, bio, location, website, socialLinks };
}

// ── Verify email ──────────────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<void> {
  const now = new Date();

  const [verification] = await db
    .select({ id: emailVerifications.id, userId: emailVerifications.userId, expiresAt: emailVerifications.expiresAt })
    .from(emailVerifications)
    .where(eq(emailVerifications.token, token));

  if (!verification) {
    throw new Error("INVALID_TOKEN");
  }

  if (verification.expiresAt < now) {
    throw new Error("TOKEN_EXPIRED");
  }

  await db
    .delete(emailVerifications)
    .where(eq(emailVerifications.id, verification.id));

  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: now })
    .where(eq(users.id, verification.userId));
}

// ── Resend verification email ──────────────────────────────────────────────────

export async function resendVerificationEmail(userId: string): Promise<void> {
  const [user] = await db
    .select({ email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.emailVerified) return; // déjà vérifié — no-op

  // Supprimer l'ancien token s'il existe
  await db
    .delete(emailVerifications)
    .where(eq(emailVerifications.userId, userId));

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFY_TTL_HOURS);

  await db.insert(emailVerifications).values({ userId, token, expiresAt });

  await sendVerificationEmail(user.email, token);
}

// ── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  // Ne pas révéler si l'email existe ou non
  if (!user) return;

  // Supprimer les anciens tokens
  await db
    .delete(passwordResets)
    .where(eq(passwordResets.userId, user.id));

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_TTL_HOURS);

  await db.insert(passwordResets).values({
    userId: user.id,
    token,
    expiresAt,
  });

  await sendPasswordResetEmail(user.email, token);
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const now = new Date();

  const [reset] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, expiresAt: passwordResets.expiresAt })
    .from(passwordResets)
    .where(eq(passwordResets.token, token));

  if (!reset) {
    throw new Error("INVALID_TOKEN");
  }

  if (reset.expiresAt < now) {
    throw new Error("TOKEN_EXPIRED");
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db
    .update(users)
    .set({ hashedPassword, updatedAt: now })
    .where(eq(users.id, reset.userId));

  await db
    .delete(passwordResets)
    .where(eq(passwordResets.id, reset.id));

  // Invalider toutes les sessions existantes
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));
}
