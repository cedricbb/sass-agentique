export const SEED_CLIENT_NAME = "Acme Studio";
export const SEED_CLIENT_WITHOUT_DRAFT_QUOTE = "Globex";
export const SEED_QUOTE_NUMBER = "Q-2026-001";
export const SEED_QUOTE_TTC_FR = "2 550,00 €";
export const SEED_INVOICE_NUMBER = "INV-2026-001";
export const SEED_INVOICE_TTC_FR = "300,00 €";
export const SEED_INVOICE_CLIENT_NAME = "Acme Studio";

export const SEED_PAYMENT_COUNT = 5;
export const SEED_PAYMENT_BANK_TRANSFER_REF = "vir_seed_003";
export const SEED_INVOICE_SENT_NUMBER = "INV-2026-002";
export const SEED_INVOICE_PAID_NUMBER = "INV-2026-003";
export const SEED_INVOICE_SENT_REMAINING_FR = "100,00 €";
export const SEED_INVOICE_SENT_TOTAL_FR = "250,00 €";

export const SEED_REPORT_TITLE_DRAFT = "Livrable v1 site vitrine";
export const SEED_REPORT_TITLE_ISSUED_MONTHLY = "Rapport mensuel maintenance — Janvier 2026";
export const SEED_REPORT_TITLE_ISSUED_AUDIT = "Audit sécurité Q1 2026";
export const SEED_REPORT_TITLE_ISSUED_ACME_MONTHLY = "Rapport mensuel Acme — Avril 2026";
export const SEED_REPORT_COUNT = 4;
export const UPLOAD_REPORT_FIXTURE_PATH = "tests/e2e/fixtures/sample-report.pdf";

export function uniqueReportTitle(): string {
  return `e2e-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueProjectName(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueItemDescription(): string {
  return `e2e-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueClientName(): string {
  return `e2e-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const SEED_CONTRACT_COUNT = 3;
export const SEED_CONTRACT_ACTIVE_COUNT = 2;
export const SEED_CONTRACT_CANCELED_COUNT = 1;
export const SEED_CONTRACT_PRESTATION = "Maintenance mensuelle";
export const SEED_CONTRACT_PRICE_FR = "50,00 €";
