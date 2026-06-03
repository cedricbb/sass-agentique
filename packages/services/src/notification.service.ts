import { Resend } from "resend";
import { env } from "@saas/config";
import { db, clientContacts, quotes, clients } from "@saas/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { computeQuoteTtc } from "./quote.shared";
import { renderQuoteSentHtml } from "./emails/QuoteSentEmail";

export type NotificationEvent = "quote.sent" | "invoice.sent" | "report.issued";
export type NotificationPayload = { clientId: string; entityId: string; tenantId: string };
export type NotifiableContact = { id: string; name: string; email: string; userId: string };

let resendInstance: Resend | null = null;

export function getResendClient(): Resend {
  if (resendInstance) return resendInstance;
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  resendInstance = new Resend(apiKey);
  return resendInstance;
}

async function sendNotificationEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log("[notification.service] RESEND_API_KEY not set, email skipped", { to: params.to, subject: params.subject });
    return;
  }
  const resend = getResendClient();
  await resend.emails.send({
    from: "SaaS Agentique <noreply@saas-agentique.io>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

async function handleQuoteSentNotification(payload: NotificationPayload): Promise<void> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, payload.entityId));
  if (!quote) {
    console.warn("[notification.service] quote not found for quote.sent", { entityId: payload.entityId });
    return;
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, payload.clientId));
  if (!client) {
    console.warn("[notification.service] client not found for quote.sent", { clientId: payload.clientId });
    return;
  }

  const contacts = await getNotifiableContacts(payload.clientId);
  if (contacts.length === 0) {
    console.warn("[notification.service] no notifiable contacts for quote.sent", { clientId: payload.clientId });
    return;
  }

  const { totalTtcCents } = computeQuoteTtc(quote);
  const totalTtcFormatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalTtcCents / 100);
  const ctaUrl = `${env.APP_URL ?? "http://localhost:3001"}/account/quotes/${quote.id}`;
  const html = await renderQuoteSentHtml({
    quoteNumber: quote.number,
    clientName: client.name,
    totalTtcFormatted,
    ctaUrl,
  });

  for (const contact of contacts) {
    await sendNotificationEmail({
      to: contact.email,
      subject: `Nouveau devis ${quote.number} disponible`,
      html,
    });
  }
}

export const DISPATCH_MAP: Record<NotificationEvent, ((payload: NotificationPayload) => Promise<void>) | null> = {
  "quote.sent": handleQuoteSentNotification,
  "invoice.sent": null,
  "report.issued": null,
};

export async function dispatchNotification(
  event: NotificationEvent,
  payload: NotificationPayload,
): Promise<void> {
  if (process.env.NOTIFICATIONS_ENABLED !== "true") return;
  const handler = DISPATCH_MAP[event];
  if (!handler) {
    console.warn(`[notification.service] no handler for event "${event}"`, { event });
    return;
  }
  try {
    await handler(payload);
  } catch (error) {
    console.error(JSON.stringify({ event, message: (error as Error).message }));
  }
}

export async function getNotifiableContacts(clientId: string): Promise<NotifiableContact[]> {
  const rows = await db
    .select({
      id: clientContacts.id,
      name: clientContacts.name,
      email: clientContacts.email,
      userId: clientContacts.userId,
    })
    .from(clientContacts)
    .where(and(eq(clientContacts.clientId, clientId), isNotNull(clientContacts.userId)));
  return rows as NotifiableContact[];
}
