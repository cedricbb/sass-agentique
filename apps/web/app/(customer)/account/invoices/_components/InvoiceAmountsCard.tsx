"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { InvoiceAmounts } from "@saas/services/invoice.shared";

interface InvoiceAmountsCardProps {
  amounts: InvoiceAmounts;
}

export function InvoiceAmountsCard({ amounts }: InvoiceAmountsCardProps) {
  return (
    <Card className="max-w-xs" data-testid="invoice-amounts-card">
      <CardHeader>
        <CardTitle>Montants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total HT</span>
          <span data-testid="invoice-amount-ht">{formatCurrency(amounts.totalHtCents / 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">TVA</span>
          <span data-testid="invoice-amount-vat">{formatCurrency(amounts.vatCents / 100)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-sm">Total TTC</span>
          <span data-testid="invoice-amount-ttc">{formatCurrency(amounts.totalTtcCents / 100)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
