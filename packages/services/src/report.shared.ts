export const REPORT_KINDS = ["delivery", "monthly", "audit", "other"] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  delivery: "Livraison",
  monthly: "Mensuel",
  audit: "Audit",
  other: "Autre",
};
