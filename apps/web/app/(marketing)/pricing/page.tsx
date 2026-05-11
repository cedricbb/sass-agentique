"use client";

import { useState } from "react";
import { PLANS } from "@saas/config";
import { BillingToggle } from "@/components/billing/BillingToggle";
import { PlanCard } from "@/components/billing/PlanCard";
import { FeatureComparisonTable } from "@/components/billing/FeatureComparisonTable";
import { PricingFaq } from "@/components/billing/PricingFaq";
import type { BillingPeriod } from "@/components/billing/billing-utils";

const FAQ_ITEMS = [
  { q: "Puis-je changer de plan à tout moment ?", a: "Oui, vous pouvez upgrader ou downgrader à tout moment. Le changement prend effet immédiatement et la facturation est ajustée au prorata." },
  { q: "Y a-t-il un engagement ?", a: "Non, tous les plans sont sans engagement. Vous pouvez annuler à tout moment." },
  { q: "Comment fonctionne l'essai gratuit ?", a: "Le plan Pro inclut un essai gratuit de 14 jours. Aucune carte bancaire requise pour commencer." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Nous acceptons les cartes Visa, Mastercard et les prélèvements SEPA via Stripe." },
];

const PLAN_LIST = [PLANS.free, PLANS.pro, PLANS.business] as const;

export default function PricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Tarifs</h1>
        <p className="text-muted-foreground text-lg">Choisissez le plan adapté à votre équipe</p>
        <div className="flex justify-center">
          <BillingToggle period={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLAN_LIST.map((plan) => (
          <PlanCard key={plan.id} plan={plan} period={period} highlighted={plan.id === "pro"} />
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-center">Comparaison détaillée</h2>
        <FeatureComparisonTable />
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl font-semibold text-center">Questions fréquentes</h2>
        <PricingFaq items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
