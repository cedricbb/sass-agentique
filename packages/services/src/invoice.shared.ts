export type InvoiceAmounts = { totalHtCents: number; vatCents: number; totalTtcCents: number };

export function computeInvoiceTtc(invoice: {
  totalEurCents: number;
  vatRateBps: number;
}): InvoiceAmounts {
  const totalHtCents = invoice.totalEurCents;
  const vatCents = Math.round((totalHtCents * invoice.vatRateBps) / 10000);
  return { totalHtCents, vatCents, totalTtcCents: totalHtCents + vatCents };
}
