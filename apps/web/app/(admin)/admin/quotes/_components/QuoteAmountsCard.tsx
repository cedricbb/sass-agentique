"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { QuoteAmounts } from "@saas/services/quote.shared";

interface QuoteAmountsCardProps {
  amounts: QuoteAmounts;
}

export function QuoteAmountsCard({ amounts }: QuoteAmountsCardProps) {
  return (
    <Card className="max-w-xs">
      <CardHeader>
        <CardTitle>Montants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total HT</span>
          <span>{formatCurrency(amounts.totalHtCents / 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">TVA</span>
          <span>{formatCurrency(amounts.vatCents / 100)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-sm">Total TTC</span>
          <span>{formatCurrency(amounts.totalTtcCents / 100)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
