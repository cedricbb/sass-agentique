import { PLANS, type PlanConfig } from "@saas/config";

export type BillingPeriod = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function getMonthlyPrice(plan: PlanConfig, period: BillingPeriod): number {
  if (period === "monthly") return plan.pricing.monthlyEurCents;
  return Math.round(plan.pricing.yearlyEurCents / 12);
}

export function getQuotaPercent(current: number, max: number): number {
  if (max === -1) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

export function getQuotaVariant(current: number, max: number, threshold: number): "default" | "warning" {
  const pct = getQuotaPercent(current, max);
  return pct >= threshold ? "warning" : "default";
}

export function getPlanBadgeVariant(status: SubscriptionStatus): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<SubscriptionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    canceled: "outline",
  };
  return map[status];
}

export interface FeatureRow {
  label: string;
  free: string;
  pro: string;
  business: string;
}

function formatLimit(value: number, unit?: string): string {
  if (value === -1) return "Illimité";
  if (value === 0) return "—";
  if (unit === "Mo" && value >= 1024) return `${Math.round(value / 1024)} Go`;
  if (unit === "Mo") return `${value} Mo`;
  return value.toLocaleString("fr-FR");
}

function formatBool(value: boolean): string {
  return value ? "✓" : "✗";
}

export function getFeatureRows(): FeatureRow[] {
  const { free, pro, business } = PLANS;
  return [
    { label: "Membres max", free: formatLimit(free.limits.maxMembers), pro: formatLimit(pro.limits.maxMembers), business: formatLimit(business.limits.maxMembers) },
    { label: "Contacts", free: formatLimit(free.limits.maxContacts), pro: formatLimit(pro.limits.maxContacts), business: formatLimit(business.limits.maxContacts) },
    { label: "Tâches agent/mois", free: formatLimit(free.limits.maxAgentTasksPerMonth), pro: formatLimit(pro.limits.maxAgentTasksPerMonth), business: formatLimit(business.limits.maxAgentTasksPerMonth) },
    { label: "Emails/mois", free: formatLimit(free.limits.maxEmailsPerMonth), pro: formatLimit(pro.limits.maxEmailsPerMonth), business: formatLimit(business.limits.maxEmailsPerMonth) },
    { label: "Stockage", free: formatLimit(free.limits.storageMb, "Mo"), pro: formatLimit(pro.limits.storageMb, "Mo"), business: formatLimit(business.limits.storageMb, "Mo") },
    { label: "Workflows actifs", free: formatLimit(free.limits.maxActiveWorkflows), pro: formatLimit(pro.limits.maxActiveWorkflows), business: formatLimit(business.limits.maxActiveWorkflows) },
    { label: "Agents IA", free: formatBool(free.features.hasAiAgents), pro: formatBool(pro.features.hasAiAgents), business: formatBool(business.features.hasAiAgents) },
    { label: "Workflows", free: formatBool(free.features.hasWorkflows), pro: formatBool(pro.features.hasWorkflows), business: formatBool(business.features.hasWorkflows) },
    { label: "Domaine custom", free: formatBool(free.features.hasCustomDomain), pro: formatBool(pro.features.hasCustomDomain), business: formatBool(business.features.hasCustomDomain) },
    { label: "White-label", free: formatBool(free.features.hasWhiteLabel), pro: formatBool(pro.features.hasWhiteLabel), business: formatBool(business.features.hasWhiteLabel) },
    { label: "Analytics avancés", free: formatBool(free.features.hasAdvancedAnalytics), pro: formatBool(pro.features.hasAdvancedAnalytics), business: formatBool(business.features.hasAdvancedAnalytics) },
    { label: "Support prioritaire", free: formatBool(free.features.hasPrioritySupport), pro: formatBool(pro.features.hasPrioritySupport), business: formatBool(business.features.hasPrioritySupport) },
    { label: "SLA", free: formatBool(free.features.hasSla), pro: formatBool(pro.features.hasSla), business: formatBool(business.features.hasSla) },
    { label: "Export données", free: formatBool(free.features.hasDataExport), pro: formatBool(pro.features.hasDataExport), business: formatBool(business.features.hasDataExport) },
  ];
}

export function getStatusLabel(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = {
    active: "Actif",
    trialing: "Essai",
    past_due: "Impayé",
    canceled: "Annulé",
  };
  return map[status];
}
