import { requireCustomer } from "@/lib/auth";
import { listQuotesByClient } from "@saas/services/quote.service";
import { computeQuoteTtc } from "@saas/services/quote.shared";
import type { CustomerVisibleQuoteStatus } from "@saas/services/quote.shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const QUOTE_STATUS_LABELS: Record<CustomerVisibleQuoteStatus, string> = {
  sent: "Envoyé",
  accepted: "Accepté",
  declined: "Refusé",
  expired: "Expiré",
};

const QUOTE_STATUS_VARIANT: Record<
  CustomerVisibleQuoteStatus,
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  sent: "default",
  accepted: "success",
  declined: "destructive",
  expired: "outline",
};

export default async function CustomerQuotesPage() {
  const { client } = await requireCustomer();
  const quotes = await listQuotesByClient(client.id);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Mes devis</h2>
      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="quotes-empty">
            Aucun devis pour le moment
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border" data-testid="quotes-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Numéro</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Montant TTC</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const status = quote.status as CustomerVisibleQuoteStatus;
                const amounts = computeQuoteTtc(quote);
                const displayDate = quote.issuedAt ?? quote.createdAt;
                return (
                  <tr key={quote.id} className="border-b last:border-0" data-testid="quote-row">
                    <td className="px-4 py-3">
                      <Link
                        href={`/account/quotes/${quote.id}`}
                        className="font-medium text-primary hover:underline"
                        data-testid="quote-link"
                      >
                        {quote.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={QUOTE_STATUS_VARIANT[status]} data-testid="quote-status-badge">
                        {QUOTE_STATUS_LABELS[status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(amounts.totalTtcCents / 100)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(displayDate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
