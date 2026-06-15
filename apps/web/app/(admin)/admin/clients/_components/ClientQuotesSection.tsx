import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeQuoteTtc } from "@saas/services/quote.shared";
import type { Quote } from "@saas/db";

const STATUS_LABELS: Record<Quote["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  declined: "Refusé",
  expired: "Expiré",
};

const STATUS_BADGE_VARIANT: Record<
  Quote["status"],
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  draft: "secondary",
  sent: "default",
  accepted: "success",
  declined: "destructive",
  expired: "outline",
};

interface ClientQuotesSectionProps {
  quotes: Quote[];
}

export function ClientQuotesSection({ quotes }: ClientQuotesSectionProps) {
  return (
    <section data-testid="client-quotes-section">
      <h2 className="text-lg font-semibold mb-4">Devis</h2>
      {quotes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun devis pour ce client.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Numéro</th>
              <th className="text-left p-2">Statut</th>
              <th className="text-left p-2">Émis le</th>
              <th className="text-left p-2">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-b">
                <td className="p-2">
                  <Link href={`/admin/quotes/${quote.id}`} className="hover:underline">
                    {quote.number}
                  </Link>
                </td>
                <td className="p-2">
                  <Badge variant={STATUS_BADGE_VARIANT[quote.status]}>
                    {STATUS_LABELS[quote.status]}
                  </Badge>
                </td>
                <td className="p-2">{formatDate(quote.issuedAt)}</td>
                <td className="p-2">
                  {formatCurrency(computeQuoteTtc(quote).totalTtcCents / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
