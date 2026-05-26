import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { MODE_LABELS, STATUS_LABELS, STATUS_VARIANTS, formatPeriod } from "./ContractRow";

interface ContractDetailFieldsProps {
  clientName: string;
  prestationName: string;
  contract: {
    billingMode: string;
    status: string;
    monthlyPriceEurCents: number;
    startedAt: Date;
    canceledAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  };
}

function Field({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </div>
  );
}

export function ContractDetailFields({ clientName, prestationName, contract }: ContractDetailFieldsProps) {
  return (
    <dl className="grid grid-cols-2 gap-4">
      <Field label="Client" testId="contract-client-name">{clientName}</Field>
      <Field label="Prestation" testId="contract-prestation-name">{prestationName}</Field>
      <Field label="Mode" testId="contract-mode">
        <Badge variant="outline">{MODE_LABELS[contract.billingMode] ?? contract.billingMode}</Badge>
      </Field>
      <Field label="Statut" testId="contract-status">
        <Badge variant={STATUS_VARIANTS[contract.status] ?? "default"}>
          {STATUS_LABELS[contract.status] ?? contract.status}
        </Badge>
      </Field>
      <Field label="Prix mensuel" testId="contract-price">
        {formatCurrency(contract.monthlyPriceEurCents / 100)}
      </Field>
      <Field label="Date de début" testId="contract-started-at">{formatDate(contract.startedAt)}</Field>
      {contract.canceledAt && (
        <Field label="Annulé le" testId="contract-canceled-at">{formatDate(contract.canceledAt)}</Field>
      )}
      <Field label="Période en cours" testId="contract-period">
        {formatPeriod(contract.currentPeriodStart, contract.currentPeriodEnd)}
      </Field>
    </dl>
  );
}
