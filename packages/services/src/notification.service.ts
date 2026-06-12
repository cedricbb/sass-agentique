import { getResendClient } from "./resend.client";
import nodemailer from "nodemailer";
import { env } from "@saas/config";
import { db, clientContacts, quotes, clients, invoices, reports, users } from "@saas/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { computeQuoteTtc } from "./quote.shared";
import { computeInvoiceTtc } from "./invoice.shared";
import { REPORT_KIND_LABELS } from "./report.shared";
import { renderQuoteSentHtml } from "./emails/QuoteSentEmail";
import { renderInvoiceSentHtml } from "./emails/InvoiceSentEmail";
import { renderReportIssuedHtml } from "./emails/ReportIssuedEmail";

const FROM = "SaaS Agentique <noreply@saas-agentique.io>";

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

export type NotificationEvent = "quote.sent" | "invoice.sent" | "report.issued" | "payment.failed";
export type NotificationPayload = { clientId: string; entityId: string; tenantId: string };
export type AdminNotificationPayload = { invoiceId: string; tenantId: string };
export type NotifiableContact = { id: string; name: string; email: string; userId: string };

async function sendNotificationEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const { to, subject, html } = params;

  if (env.SMTP_HOST) {
    const transport = createSmtpTransport();
    await transport.sendMail({ from: FROM, to, subject, html });
    return;
  }

  if (env.RESEND_API_KEY) {
    const resend = getResendClient();
    await resend.emails.send({ from: FROM, to, subject, html });
    return;
  }

  console.log("[notification.service] no transport configured, email skipped", { to, subject });
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

async function handleReportIssuedNotification(payload: NotificationPayload): Promise<void> {
  const [report] = await db.select().from(reports).where(eq(reports.id, payload.entityId));
  if (!report) {
    console.warn("[notification.service] report not found for report.issued", { entityId: payload.entityId });
    return;
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, payload.clientId));
  if (!client) {
    console.warn("[notification.service] client not found for report.issued", { clientId: payload.clientId });
    return;
  }

  const contacts = await getNotifiableContacts(payload.clientId);
  if (contacts.length === 0) {
    console.warn("[notification.service] no notifiable contacts for report.issued", { clientId: payload.clientId });
    return;
  }

  const kindLabel = REPORT_KIND_LABELS[report.kind] ?? report.kind;
  const issuedAtFormatted = report.issuedAt
    ? new Intl.DateTimeFormat("fr-FR").format(report.issuedAt)
    : "";
  const ctaUrl = `${env.APP_URL ?? "http://localhost:3001"}/account/reports/${report.id}`;
  const html = await renderReportIssuedHtml({
    reportTitle: report.title,
    kindLabel,
    clientName: client.name,
    issuedAtFormatted,
    ctaUrl,
  });

  for (const contact of contacts) {
    await sendNotificationEmail({
      to: contact.email,
      subject: `Rapport ${kindLabel} "${report.title}" disponible`,
      html,
    });
  }
}

async function handleInvoiceSentNotification(payload: NotificationPayload): Promise<void> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, payload.entityId));
  if (!invoice) {
    console.warn("[notification.service] invoice not found for invoice.sent", { entityId: payload.entityId });
    return;
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, payload.clientId));
  if (!client) {
    console.warn("[notification.service] client not found for invoice.sent", { clientId: payload.clientId });
    return;
  }

  const contacts = await getNotifiableContacts(payload.clientId);
  if (contacts.length === 0) {
    console.warn("[notification.service] no notifiable contacts for invoice.sent", { clientId: payload.clientId });
    return;
  }

  const { totalTtcCents } = computeInvoiceTtc(invoice);
  const totalTtcFormatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalTtcCents / 100);
  const dueDateFormatted = invoice.dueAt ? new Intl.DateTimeFormat("fr-FR").format(invoice.dueAt) : null;
  const ctaUrl = `${env.APP_URL ?? "http://localhost:3001"}/account/invoices/${invoice.id}`;
  const html = await renderInvoiceSentHtml({
    invoiceNumber: invoice.number,
    clientName: client.name,
    totalTtcFormatted,
    dueDateFormatted,
    ctaUrl,
  });

  for (const contact of contacts) {
    await sendNotificationEmail({
      to: contact.email,
      subject: `Nouvelle facture ${invoice.number} disponible`,
      html,
    });
  }
}

async function handlePaymentFailedNotification(payload: AdminNotificationPayload): Promise<void> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, payload.invoiceId));
  if (!invoice) {
    console.warn("[notification.service] invoice not found for payment.failed", { invoiceId: payload.invoiceId });
    return;
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
  if (!client) {
    console.warn("[notification.service] client not found for payment.failed", { clientId: invoice.clientId });
    return;
  }

  const [adminUser] = await db.select().from(users).where(eq(users.id, payload.tenantId));
  if (!adminUser) {
    console.warn("[notification.service] admin user not found for payment.failed", { tenantId: payload.tenantId });
    return;
  }

  const { totalTtcCents } = computeInvoiceTtc(invoice);
  const totalTtcFormatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalTtcCents / 100);

  const html = `<h2>Échec de paiement — Facture ${invoice.number}</h2><p>Le paiement de la facture <strong>${invoice.number}</strong> pour le client <strong>${client.name}</strong> a échoué.</p><p>Montant TTC : ${totalTtcFormatted}</p><p>Vérifiez le tableau de bord Stripe pour plus de détails et relancez manuellement si nécessaire.</p>`;

  await sendNotificationEmail({
    to: adminUser.email,
    subject: `Échec paiement facture ${invoice.number}`,
    html,
  });
}

type AnyNotificationPayload = NotificationPayload | AdminNotificationPayload;
type NotificationHandler = (payload: AnyNotificationPayload) => Promise<void>;

export const DISPATCH_MAP: Record<NotificationEvent, NotificationHandler | null> = {
  "quote.sent": handleQuoteSentNotification as NotificationHandler,
  "invoice.sent": handleInvoiceSentNotification as NotificationHandler,
  "report.issued": handleReportIssuedNotification as NotificationHandler,
  "payment.failed": handlePaymentFailedNotification as NotificationHandler,
};

export async function dispatchNotification(
  event: NotificationEvent,
  payload: NotificationPayload | AdminNotificationPayload,
): Promise<void> {
  if (!env.NOTIFICATIONS_ENABLED) return;
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
