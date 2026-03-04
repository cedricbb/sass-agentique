import { Resend } from "resend";
import nodemailer from "nodemailer";
import { env } from "@saas/config";

const FROM = "SaaS Agentique <noreply@saas-agentique.io>";
const APP_URL = env.APP_URL ?? "http://localhost:3001";

// ── Transport ──────────────────────────────────────────────────────────────────
// Priorité : SMTP (MailHog / dev) > Resend > console.log

function createSmtpTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
}

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail({ to, subject, html }: EmailPayload): Promise<void> {
  // 1. SMTP configuré (MailHog en dev, tout serveur SMTP en prod)
  if (env.SMTP_HOST) {
    const transport = createSmtpTransport();
    await transport.sendMail({ from: FROM, to, subject, html });
    return;
  }

  // 2. Resend configuré
  if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
    return;
  }

  // 3. Fallback dev — log dans la console
  console.log(`[email.service] Aucun transport configuré — email vers ${to}`);
  console.log(`[email.service] Subject: ${subject}`);
}

// ── Emails ─────────────────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const url = `${APP_URL}/verify-email?token=${token}`;

  if (!env.SMTP_HOST && !env.RESEND_API_KEY) {
    console.log(`[email.service] verification URL: ${url}`);
    return;
  }

  await sendEmail({
    to: email,
    subject: "Vérifiez votre adresse email",
    html: `
      <h1>Bienvenue sur SaaS Agentique !</h1>
      <p>Cliquez sur le lien ci-dessous pour vérifier votre adresse email :</p>
      <a href="${url}" style="background:#0070f3;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
        Vérifier mon email
      </a>
      <p>Ce lien expire dans 24 heures.</p>
      <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${token}`;

  if (!env.SMTP_HOST && !env.RESEND_API_KEY) {
    console.log(`[email.service] reset URL: ${url}`);
    return;
  }

  await sendEmail({
    to: email,
    subject: "Réinitialisation de votre mot de passe",
    html: `
      <h1>Réinitialisation de mot de passe</h1>
      <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
      <a href="${url}" style="background:#0070f3;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
        Réinitialiser mon mot de passe
      </a>
      <p>Ce lien expire dans 1 heure.</p>
      <p>Si vous n'avez pas demandé de réinitialisation, ignorez cet email.</p>
    `,
  });
}

export async function sendInvitationEmail(
  email: string,
  token: string,
  tenantName: string,
  inviterName?: string,
): Promise<void> {
  const url = `${APP_URL}/accept-invitation?token=${token}`;

  if (!env.SMTP_HOST && !env.RESEND_API_KEY) {
    console.log(`[email.service] invitation URL: ${url}`);
    return;
  }

  await sendEmail({
    to: email,
    subject: `Invitation à rejoindre ${tenantName}`,
    html: `
      <h1>Vous êtes invité à rejoindre ${tenantName}</h1>
      <p>${inviterName ? `${inviterName} vous invite` : "Vous êtes invité"} à rejoindre l'espace <strong>${tenantName}</strong>.</p>
      <a href="${url}" style="background:#0070f3;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
        Accepter l'invitation
      </a>
      <p>Ce lien expire dans 7 jours.</p>
      <p>Si vous n'êtes pas concerné par cette invitation, ignorez cet email.</p>
    `,
  });
}
