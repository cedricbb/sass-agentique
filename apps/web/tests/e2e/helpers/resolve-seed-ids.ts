import { getInvoiceByNumber, getQuoteByNumber } from "@saas/services";

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
