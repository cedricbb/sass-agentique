import { getInvoiceByNumber, getQuoteByNumber, getReportByTitle, getClientBySlug } from "@saas/services";
import { db, customerInvitations, users } from "@saas/db";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function resolveInvoiceId(invoiceNumber: string): Promise<string> {
  const invoice = await getInvoiceByNumber(invoiceNumber);
  if (!invoice) throw new Error(`Seed invoice ${invoiceNumber} not found`);
  return invoice.id;
}

export async function resolveQuoteId(quoteNumber: string): Promise<string> {
  const quote = await getQuoteByNumber(quoteNumber);
  if (!quote) throw new Error(`Seed quote ${quoteNumber} not found`);
  return quote.id;
}

export async function resolveReportId(reportTitle: string): Promise<string> {
  const report = await getReportByTitle(reportTitle);
  if (!report) throw new Error(`Seed report "${reportTitle}" not found`);
  return report.id;
}

export async function getInvitationTokenForContact(contactEmail: string): Promise<string> {
  const [row] = await db
    .select({ token: customerInvitations.token })
    .from(customerInvitations)
    .where(and(eq(customerInvitations.email, contactEmail), isNull(customerInvitations.consumedAt)))
    .orderBy(desc(customerInvitations.createdAt))
    .limit(1);
  if (!row) throw new Error(`No active invitation found for email: ${contactEmail}`);
  return row.token;
}

export async function resolveClientIdBySlug(slug: string): Promise<string> {
  const client = await getClientBySlug(slug);
  if (!client) throw new Error(`Client with slug "${slug}" not found`);
  return client.id;
}

export async function resolveAdminId(): Promise<string> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@saas.dev"))
    .limit(1);
  if (!row) throw new Error("Admin user not found in DB");
  return row.id;
}
