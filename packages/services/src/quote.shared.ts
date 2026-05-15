export type QuoteAmounts = {
  totalHtCents: number;
  vatCents: number;
  totalTtcCents: number;
};

export function computeQuoteTtc(quote: {
  totalEurCents: number;
  vatRateBps: number;
}): QuoteAmounts {
  const totalHtCents = quote.totalEurCents;
  const vatCents = Math.round(
    (totalHtCents * quote.vatRateBps) / 10000,
  );
  return {
    totalHtCents,
    vatCents,
    totalTtcCents: totalHtCents + vatCents,
  };
}
