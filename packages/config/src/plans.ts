export type PlanId = "free" | "pro" | "business";

export interface PlanLimits {
  maxMembers: number;
  maxContacts: number;
  maxAgentTasksPerMonth: number;
  maxEmailsPerMonth: number;
  storageMb: number;
  maxActiveWorkflows: number;
}

export interface PlanFeatures {
  hasTwoFactor: boolean;
  hasAdminBackoffice: boolean;
  hasAiAgents: boolean;
  hasWorkflows: boolean;
  hasCustomDomain: boolean;
  hasWhiteLabel: boolean;
  hasAdvancedAnalytics: boolean;
  hasPrioritySupport: boolean;
  hasSla: boolean;
  hasDataExport: boolean;
}

export interface PlanPricing {
  monthlyEurCents: number;
  yearlyEurCents: number;
  yearlyDiscountPercent: number;
}

export interface PlanConfig {
  id: PlanId;
  slug: PlanId;
  name: string;
  sortOrder: number;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
  stripeProductId: string | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    slug: "free",
    name: "Free",
    sortOrder: 0,
    pricing: {
      monthlyEurCents: 0,
      yearlyEurCents: 0,
      yearlyDiscountPercent: 0,
    },
    limits: {
      maxMembers: 3,
      maxContacts: 500,
      maxAgentTasksPerMonth: 10,
      maxEmailsPerMonth: 200,
      storageMb: 100,
      maxActiveWorkflows: 0,
    },
    features: {
      hasTwoFactor: true,
      hasAdminBackoffice: false,
      hasAiAgents: false,
      hasWorkflows: false,
      hasCustomDomain: false,
      hasWhiteLabel: false,
      hasAdvancedAnalytics: false,
      hasPrioritySupport: false,
      hasSla: false,
      hasDataExport: false,
    },
    stripeProductId: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
  },

  pro: {
    id: "pro",
    slug: "pro",
    name: "Pro",
    sortOrder: 1,
    pricing: {
      monthlyEurCents: 2900,
      yearlyEurCents: 29000,
      yearlyDiscountPercent: 17,
    },
    limits: {
      maxMembers: 10,
      maxContacts: 5000,
      maxAgentTasksPerMonth: 200,
      maxEmailsPerMonth: 5000,
      storageMb: 5120,
      maxActiveWorkflows: 5,
    },
    features: {
      hasTwoFactor: true,
      hasAdminBackoffice: true,
      hasAiAgents: true,
      hasWorkflows: true,
      hasCustomDomain: false,
      hasWhiteLabel: false,
      hasAdvancedAnalytics: false,
      hasPrioritySupport: true,
      hasSla: false,
      hasDataExport: true,
    },
    stripeProductId: process.env.STRIPE_PRODUCT_ID_PRO ?? null,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? null,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY ?? null,
  },

  business: {
    id: "business",
    slug: "business",
    name: "Business",
    sortOrder: 2,
    pricing: {
      monthlyEurCents: 9900,
      yearlyEurCents: 99000,
      yearlyDiscountPercent: 17,
    },
    limits: {
      maxMembers: 50,
      maxContacts: -1,
      maxAgentTasksPerMonth: 2000,
      maxEmailsPerMonth: 50000,
      storageMb: 51200,
      maxActiveWorkflows: -1,
    },
    features: {
      hasTwoFactor: true,
      hasAdminBackoffice: true,
      hasAiAgents: true,
      hasWorkflows: true,
      hasCustomDomain: true,
      hasWhiteLabel: true,
      hasAdvancedAnalytics: true,
      hasPrioritySupport: true,
      hasSla: true,
      hasDataExport: true,
    },
    stripeProductId: process.env.STRIPE_PRODUCT_ID_BUSINESS ?? null,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY ?? null,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ID_BUSINESS_YEARLY ?? null,
  },
};
