import { requireCustomer } from "@/lib/auth";
import { listInvoicesByClient } from "@saas/services/invoice.service";
import { computeInvoiceTtc } from "@saas/services/invoice.shared";
import type { CustomerVisibleInvoiceStatus } from "@saas/services/invoice.shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const INVOICE_STATUS_LABELS: Record<CustomerVisibleInvoiceStatus, string> = {
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

const INVOICE_STATUS_VARIANT: Record<
  CustomerVisibleInvoiceStatus,
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  sent: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

export default async function CustomerInvoicesPage() {
  const { client } = await requireCustomer();
  const invoices = await listInvoicesByClient(client.id);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Mes factures</h2>
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="invoices-empty">
            Aucune facture pour le moment
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border" data-testid="invoices-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Numéro</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Montant TTC</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const status = invoice.status as CustomerVisibleInvoiceStatus;
                const amounts = computeInvoiceTtc(invoice);
                const displayDate = invoice.issuedAt ?? invoice.createdAt;
                return (
                  <tr key={invoice.id} className="border-b last:border-0" data-testid="invoice-row">
                    <td className="px-4 py-3">
                      <Link
                        href={`/account/invoices/${invoice.id}`}
                        className="font-medium text-primary hover:underline"
                        data-testid="invoice-link"
                      >
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={INVOICE_STATUS_VARIANT[status]} data-testid="invoice-status-badge">
                        {INVOICE_STATUS_LABELS[status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(amounts.totalTtcCents / 100)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(displayDate)}
                    </td>
                    <td className="px-4 py-3">
                      {invoice.dueAt ? formatDate(invoice.dueAt) : "—"}
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
