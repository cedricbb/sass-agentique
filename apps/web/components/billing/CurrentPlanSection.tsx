import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PlanConfig } from "@saas/config";
import { PlanBadge } from "./PlanBadge";
import type { SubscriptionStatus } from "./billing-utils";

export function CurrentPlanSection({ plan, status, renewsAt, cancelAt, trialEnd }: {
  plan: PlanConfig;
  status: SubscriptionStatus;
  renewsAt?: Date;
  cancelAt?: Date;
  trialEnd?: Date;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Plan {plan.name}</h3>
          <PlanBadge planId={plan.id} status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {status === "trialing" && trialEnd && (
          <p>Votre essai se termine le {trialEnd.toLocaleDateString("fr-FR")}</p>
        )}
        {status === "canceled" && cancelAt && (
          <p>Actif jusqu&apos;au {cancelAt.toLocaleDateString("fr-FR")}</p>
        )}
        {status === "active" && renewsAt && (
          <p className="text-muted-foreground">Prochain renouvellement : {renewsAt.toLocaleDateString("fr-FR")}</p>
        )}
        {plan.id === "free" && (
          <p className="text-muted-foreground">Plan gratuit — aucune facturation</p>
        )}
      </CardContent>
    </Card>
  );
}
