import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { assertClientOwnership } from "@/lib/auth";
import { getQuoteById, listQuoteItems, computeQuoteTtc } from "@saas/services/quote.service";
import type { CustomerVisibleQuoteStatus } from "@saas/services/quote.shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { QuoteAmountsCard } from "../_components/QuoteAmountsCard";

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

export default async function CustomerQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireCustomer();
  const quote = await getQuoteById(id);

  if (!quote || quote.status === "draft") notFound();

  assertClientOwnership(quote, scope);

  const items = await listQuoteItems(quote.id);
  const amounts = computeQuoteTtc(quote);
  const status = quote.status as CustomerVisibleQuoteStatus;

  return (
    <div className="space-y-6" data-testid="quote-detail">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{quote.number}</h2>
        <Badge variant={QUOTE_STATUS_VARIANT[status]} data-testid="quote-detail-status">
          {QUOTE_STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className="flex gap-6 text-sm text-muted-foreground">
        {quote.issuedAt && (
          <span data-testid="quote-issued-date">Émis le {formatDate(quote.issuedAt)}</span>
        )}
        {quote.expiresAt && (
          <span data-testid="quote-expires-date">Expire le {formatDate(quote.expiresAt)}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-md border" data-testid="quote-items-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Qté</th>
                <th className="px-4 py-3 text-right font-medium">PU €</th>
                <th className="px-4 py-3 text-right font-medium">Total €</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0" data-testid="quote-item-row">
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(item.unitPriceEurCents / 100)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency((item.quantity * item.unitPriceEurCents) / 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QuoteAmountsCard amounts={amounts} />
    </div>
  );
}
