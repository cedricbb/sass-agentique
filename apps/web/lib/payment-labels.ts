export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe_card: "Carte Stripe",
  bank_transfer: "Virement",
  other: "Autre",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
