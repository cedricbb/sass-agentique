import { PLANS, type PlanId } from "@saas/config";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrentPlanSection } from "@/components/billing/CurrentPlanSection";
import { QuotaBar } from "@/components/billing/QuotaBar";
import { InvoiceHistory } from "@/components/billing/InvoiceHistory";
import { StripePortalButton } from "@/components/billing/StripePortalButton";
import type { SubscriptionStatus } from "@/components/billing/billing-utils";
import type { Invoice } from "@/components/billing/InvoiceRow";

interface BillingInfo {
  planId: PlanId;
  status: SubscriptionStatus;
  renewsAt?: string;
  cancelAt?: string;
  trialEnd?: string;
  tenantId: string;
  usage: { agentTasks: number; emails: number; storageMb: number; contacts: number };
  invoices: Invoice[];
}

async function getBillingInfo(): Promise<BillingInfo> {
  return {
    planId: "pro",
    status: "active",
    renewsAt: "2026-06-11",
    tenantId: "tenant_demo",
    usage: { agentTasks: 42, emails: 1200, storageMb: 1500, contacts: 890 },
    invoices: [],
  };
}

export default async function BillingPage() {
  const info = await getBillingInfo();
  const plan = PLANS[info.planId];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Facturation</h1>

      {info.status === "past_due" && (
        <Alert variant="destructive">
          <AlertDescription>
            Paiement échoué — mettez à jour votre moyen de paiement.
            <StripePortalButton tenantId={info.tenantId} />
          </AlertDescription>
        </Alert>
      )}

      <CurrentPlanSection
        plan={plan}
        status={info.status}
        renewsAt={info.renewsAt ? new Date(info.renewsAt) : undefined}
        cancelAt={info.cancelAt ? new Date(info.cancelAt) : undefined}
        trialEnd={info.trialEnd ? new Date(info.trialEnd) : undefined}
      />

      {info.planId === "free" && (
        <Button asChild>
          <a href="/pricing">Passer à Pro</a>
        </Button>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Utilisation</h2>
        <QuotaBar label="Tâches agent ce mois" current={info.usage.agentTasks} max={plan.limits.maxAgentTasksPerMonth} threshold={80} />
        <QuotaBar label="Emails ce mois" current={info.usage.emails} max={plan.limits.maxEmailsPerMonth} threshold={80} />
        <QuotaBar label="Stockage" current={info.usage.storageMb} max={plan.limits.storageMb} unit="Mo" threshold={90} />
        <QuotaBar label="Contacts" current={info.usage.contacts} max={plan.limits.maxContacts} threshold={90} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Historique de facturation</h2>
        <InvoiceHistory invoices={info.invoices} />
      </div>

      {info.planId !== "free" && (
        <StripePortalButton tenantId={info.tenantId} />
      )}
    </div>
  );
}
