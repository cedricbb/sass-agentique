import { eq, and } from "drizzle-orm";
import { db } from "@saas/db";
import { users, sessions, totpChallenges } from "@saas/db";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { env } from "@saas/config";

const BCRYPT_ROUNDS = 12;
const CHALLENGE_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;
const BACKUP_CODE_COUNT = 10;
const TOTP_ISSUER = env.TOTP_ISSUER ?? "SaaS Agentique";

function sessionExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// ── Generate TOTP secret + QR code ────────────────────────────────────────────

export async function generateTotpSecret(
  email: string,
): Promise<{ secret: string; qrDataUrl: string }> {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, TOTP_ISSUER, secret);
  const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
  return { secret, qrDataUrl };
}

// ── Verify TOTP code ───────────────────────────────────────────────────────────

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

// ── Backup codes ──────────────────────────────────────────────────────────────

export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(5).toString("hex"),
  );
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
}

export async function verifyAndConsumeBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const [user] = await db
    .select({ backupCodes: users.backupCodes })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || !user.backupCodes || user.backupCodes.length === 0) {
    return false;
  }

  let matchedIndex = -1;
  for (let i = 0; i < user.backupCodes.length; i++) {
    const match = await bcrypt.compare(code, user.backupCodes[i]);
    if (match) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) return false;

  const remaining = user.backupCodes.filter((_, i) => i !== matchedIndex);
  await db
    .update(users)
    .set({ backupCodes: remaining, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return true;
}

// ── Enable TOTP ────────────────────────────────────────────────────────────────

export async function enableTotp(
  userId: string,
  secret: string,
  code: string,
): Promise<{ backupCodes: string[] }> {
  if (!verifyTotpCode(secret, code)) {
    throw new Error("INVALID_TOTP_CODE");
  }

  const plainCodes = generateBackupCodes();
  const hashedCodes = await hashBackupCodes(plainCodes);

  await db
    .update(users)
    .set({
      totpSecret: secret,
      totpEnabled: true,
      backupCodes: hashedCodes,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { backupCodes: plainCodes };
}

// ── Disable TOTP ───────────────────────────────────────────────────────────────

export async function disableTotp(
  userId: string,
  codeOrBackup: string,
): Promise<void> {
  const [user] = await db
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.totpEnabled, true)));

  if (!user) {
    throw new Error("TOTP_NOT_ENABLED");
  }

  let valid = false;
  if (user.totpSecret) {
    valid = verifyTotpCode(user.totpSecret, codeOrBackup);
  }
  if (!valid) {
    valid = await verifyAndConsumeBackupCode(userId, codeOrBackup);
  }

  if (!valid) {
    throw new Error("INVALID_CODE");
  }

  await db
    .update(users)
    .set({
      totpEnabled: false,
      totpSecret: null,
      backupCodes: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// ── TOTP Challenges (2nd login step) ──────────────────────────────────────────

export async function createTotpChallenge(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_TTL_MINUTES);

  await db.insert(totpChallenges).values({ userId, token, expiresAt });

  return token;
}

export type TotpChallengeResult = {
  sessionToken: string;
  userId: string;
  tenantSlug: string;
};

export async function consumeTotpChallenge(
  challengeToken: string,
  code: string,
): Promise<TotpChallengeResult> {
  const now = new Date();

  const [challenge] = await db
    .select({
      id: totpChallenges.id,
      userId: totpChallenges.userId,
      expiresAt: totpChallenges.expiresAt,
    })
    .from(totpChallenges)
    .where(eq(totpChallenges.token, challengeToken));

  if (!challenge) {
    throw new Error("CHALLENGE_NOT_FOUND");
  }

  if (challenge.expiresAt < now) {
    await db
      .delete(totpChallenges)
      .where(eq(totpChallenges.id, challenge.id));
    throw new Error("CHALLENGE_EXPIRED");
  }

  const [user] = await db
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, challenge.userId));

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  let valid = false;
  if (user.totpSecret) {
    valid = verifyTotpCode(user.totpSecret, code);
  }
  if (!valid) {
    valid = await verifyAndConsumeBackupCode(challenge.userId, code);
  }

  if (!valid) {
    throw new Error("INVALID_TOTP_CODE");
  }

  // Supprimer le challenge
  await db
    .delete(totpChallenges)
    .where(eq(totpChallenges.id, challenge.id));

  // Créer la session
  const sessionToken = generateToken();
  await db.insert(sessions).values({
    userId: challenge.userId,
    sessionToken,
    expires: sessionExpiresAt(),
  });

  return {
    sessionToken,
    userId: challenge.userId,
    tenantSlug: "",
  };
}

// ── Get user TOTP status ──────────────────────────────────────────────────────

export async function getUserTotpStatus(
  userId: string,
): Promise<{ totpEnabled: boolean }> {
  const [user] = await db
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, userId));

  return { totpEnabled: user?.totpEnabled ?? false };
}

// ── Regenerate backup codes ───────────────────────────────────────────────────

export async function regenerateBackupCodes(
  userId: string,
): Promise<string[]> {
  const plainCodes = generateBackupCodes();
  const hashedCodes = await hashBackupCodes(plainCodes);

  await db
    .update(users)
    .set({ backupCodes: hashedCodes, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return plainCodes;
}
