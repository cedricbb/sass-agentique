import { Resend } from "resend";
import { env } from "@saas/config";
import { db, clientContacts } from "@saas/db";
import { eq, and, isNotNull } from "drizzle-orm";

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

const DISPATCH_MAP: Record<NotificationEvent, ((payload: NotificationPayload) => Promise<void>) | null> = {
  "quote.sent": null,
  "invoice.sent": null,
  "report.issued": null,
};

export async function dispatchNotification(
  event: NotificationEvent,
  payload: NotificationPayload,
): Promise<void> {
  const handler = DISPATCH_MAP[event];
  if (!handler) {
    console.warn(`[notification.service] no handler for event "${event}"`, { event });
    return;
  }
  try {
    await handler(payload);
  } catch (error) {
    console.error(`[notification.service] dispatch failed for "${event}"`, { event, error });
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
