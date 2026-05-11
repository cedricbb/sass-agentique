import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlanConfig } from "@saas/config";
import { cn } from "@/lib/utils";
import { formatPrice, getMonthlyPrice, type BillingPeriod } from "./billing-utils";

const CTA_MAP: Record<string, { label: string; variant: "default" | "outline" }> = {
  free: { label: "Commencer gratuitement", variant: "outline" },
  pro: { label: "Essai gratuit 14j", variant: "default" },
  business: { label: "Contacter l'équipe", variant: "outline" },
};

const LIMIT_LABELS: { key: keyof PlanConfig["limits"]; label: string }[] = [
  { key: "maxMembers", label: "membres" },
  { key: "maxContacts", label: "contacts" },
  { key: "maxAgentTasksPerMonth", label: "tâches agent/mois" },
  { key: "maxEmailsPerMonth", label: "emails/mois" },
  { key: "storageMb", label: "stockage" },
];

function formatLimitValue(value: number, key: string): string {
  if (value === -1) return "Illimité";
  if (key === "storageMb" && value >= 1024) return `${Math.round(value / 1024)} Go`;
  if (key === "storageMb") return `${value} Mo`;
  return value.toLocaleString("fr-FR");
}

export function PlanCard({ plan, period, highlighted }: { plan: PlanConfig; period: BillingPeriod; highlighted?: boolean }) {
  const monthly = getMonthlyPrice(plan, period);
  const cta = CTA_MAP[plan.id];

  return (
    <Card className={cn("flex flex-col", highlighted && "ring-2 ring-primary relative")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          {highlighted && <Badge>Recommandé</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div>
          <span className="text-3xl font-bold">{formatPrice(monthly)} €</span>
          <span className="text-muted-foreground text-sm">/mois</span>
          {period === "yearly" && plan.pricing.yearlyEurCents > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              facturé annuellement
              <Badge variant="secondary" className="ml-2">−{plan.pricing.yearlyDiscountPercent} %</Badge>
            </p>
          )}
        </div>
        <ul className="space-y-1.5 text-sm">
          {LIMIT_LABELS.map(({ key, label }) => (
            <li key={key} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{formatLimitValue(plan.limits[key], key)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button variant={cta.variant} className="w-full">
          {cta.label}
        </Button>
      </CardFooter>
    </Card>
  );
}
