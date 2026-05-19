"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/schemas/invoice.schemas";

interface InvoiceBalanceCardProps {
  totalTtcCents: number;
  paidCents: number;
  status: InvoiceStatus;
}

function computeBadge(
  status: InvoiceStatus,
  remainingCents: number,
): { variant: "success" | "destructive" | "default"; label: string } {
  if (status === "paid") return { variant: "success", label: "Payée" };
  if (remainingCents <= 0) return { variant: "success", label: "Soldée" };
  if (status === "overdue") return { variant: "destructive", label: "En retard" };
  return { variant: "default", label: "Reste à payer" };
}

export function InvoiceBalanceCard({ totalTtcCents, paidCents, status }: InvoiceBalanceCardProps) {
  const remainingCents = Math.max(0, totalTtcCents - paidCents);
  const badge = computeBadge(status, remainingCents);

  return (
    <Card className="max-w-xs" data-testid="invoice-balance-card">
      <CardHeader>
        <CardTitle>Solde</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total TTC</span>
          <span>{formatCurrency(totalTtcCents / 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Déjà payé</span>
          <span>{formatCurrency(paidCents / 100)}</span>
        </div>
        <div className="flex justify-between font-semibold" data-testid="invoice-balance-remaining">
          <span className="text-sm">
            Reste dû
          </span>
          <span data-testid="invoice-balance-remaining-amount">{formatCurrency(remainingCents / 100)}</span>
        </div>
        <div className="pt-2">
          <Badge variant={badge.variant} data-testid="invoice-balance-badge">
            {badge.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
