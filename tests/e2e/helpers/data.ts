export const SEED_CLIENT_NAME = "Acme Studio";
export const SEED_CLIENT_WITHOUT_DRAFT_QUOTE = "Globex";
export const SEED_QUOTE_NUMBER = "Q-2026-001";
export const SEED_QUOTE_TTC_FR = "2 550,00 €";
export const SEED_INVOICE_NUMBER = "INV-2026-001";
export const SEED_INVOICE_TTC_FR = "300,00 €";
export const SEED_INVOICE_CLIENT_NAME = "Acme Studio";

export function uniqueProjectName(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueItemDescription(): string {
  return `e2e-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
