import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

export type ContractRowData = {
  id: string;
  clientId: string;
  prestationId: string;
  billingMode: string;
  status: string;
  monthlyPriceEurCents: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

export const MODE_LABELS: Record<string, string> = {
  manual_invoice: "Facturation manuelle",
  stripe_auto: "Stripe (auto)",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  past_due: "En retard",
  canceled: "Annulé",
};

export const STATUS_VARIANTS: Record<string, "default" | "destructive" | "secondary"> = {
  active: "default",
  past_due: "destructive",
  canceled: "secondary",
};

export function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start || !end) return "—";
  return `${formatDate(start)} — ${formatDate(end)}`;
}

interface ContractRowProps {
  row: ContractRowData;
  clientName: string;
  prestationName: string;
  pending: boolean;
  onCancel: (id: string) => void;
}

export function ContractRow({ row, clientName, prestationName, pending, onCancel }: ContractRowProps) {
  return (
    <TableRow data-testid={`contract-row-${row.id}`}>
      <TableCell>{clientName}</TableCell>
      <TableCell>{prestationName}</TableCell>
      <TableCell>
        <Badge variant="outline">{MODE_LABELS[row.billingMode] ?? row.billingMode}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[row.status] ?? "default"}>
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      </TableCell>
      <TableCell>{formatCurrency(row.monthlyPriceEurCents / 100)}</TableCell>
      <TableCell>{formatPeriod(row.currentPeriodStart, row.currentPeriodEnd)}</TableCell>
      <TableCell>
        <Button
          variant="destructive"
          size="sm"
          data-testid={`contract-cancel-${row.id}`}
          disabled={row.status === "canceled" || pending}
          onClick={() => onCancel(row.id)}
        >
          Annuler
        </Button>
      </TableCell>
    </TableRow>
  );
}
