import { Resend } from "resend";
import { env } from "@saas/config";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const FROM = "SaaS Agentique <noreply@saas-agentique.io>";

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const url = `${env.APP_URL ?? "http://localhost:3001"}/verify-email?token=${token}`;

  if (!resend) {
    console.log(`[email.service] RESEND_API_KEY missing — verification URL: ${url}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
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
  const url = `${env.APP_URL ?? "http://localhost:3001"}/reset-password?token=${token}`;

  if (!resend) {
    console.log(`[email.service] RESEND_API_KEY missing — reset URL: ${url}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
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
  const url = `${env.APP_URL ?? "http://localhost:3001"}/accept-invitation?token=${token}`;

  if (!resend) {
    console.log(`[email.service] RESEND missing — invitation URL: ${url}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
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
