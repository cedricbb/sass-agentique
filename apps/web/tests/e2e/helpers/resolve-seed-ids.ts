import { getInvoiceByNumber } from "@saas/services";

export async function resolveInvoiceId(invoiceNumber: string): Promise<string> {
  const invoice = await getInvoiceByNumber(invoiceNumber);
  if (!invoice) throw new Error(`Seed invoice ${invoiceNumber} not found`);
  return invoice.id;
}
