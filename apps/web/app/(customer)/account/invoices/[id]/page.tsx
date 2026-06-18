import { notFound } from "next/navigation";
import { requireCustomer, assertClientOwnership } from "@/lib/auth";
import { getInvoiceById, listInvoiceItems } from "@saas/services/invoice.service";
import { computeInvoiceTtc } from "@saas/services/invoice.shared";
import type { CustomerVisibleInvoiceStatus } from "@saas/services/invoice.shared";
import { paymentService } from "@saas/services";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { InvoiceAmountsCard } from "../_components/InvoiceAmountsCard";
import { InvoiceBalanceCard } from "../_components/InvoiceBalanceCard";

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

export default async function CustomerInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireCustomer();
  const invoice = await getInvoiceById(id);

  if (!invoice || invoice.status === "draft") notFound();

  assertClientOwnership(invoice, scope);

  const [items, amounts, balance] = await Promise.all([
    listInvoiceItems(invoice.id),
    Promise.resolve(computeInvoiceTtc(invoice)),
    paymentService.computeInvoiceBalance(invoice.id),
  ]);

  const totalTtcCents = amounts.totalTtcCents;
  const paidCents = balance.paidCents;
  const status = invoice.status as CustomerVisibleInvoiceStatus;

  return (
    <div className="space-y-6" data-testid="invoice-detail">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{invoice.number}</h2>
        <Badge variant={INVOICE_STATUS_VARIANT[status]} data-testid="invoice-detail-status">
          {INVOICE_STATUS_LABELS[status]}
        </Badge>
        {invoice.pdfKey != null && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/account/invoices/${invoice.id}/file`} download={`facture-${invoice.number}.pdf`} data-testid="invoice-download-pdf">
              <Download className="mr-2 h-4 w-4" /> Télécharger ma facture
            </a>
          </Button>
        )}
      </div>

      <div className="flex gap-6 text-sm text-muted-foreground">
        {invoice.issuedAt && (
          <span data-testid="invoice-issued-date">Émis le {formatDate(invoice.issuedAt)}</span>
        )}
        {invoice.dueAt && (
          <span data-testid="invoice-due-date">Échéance le {formatDate(invoice.dueAt)}</span>
        )}
        {invoice.paidAt && (
          <span data-testid="invoice-paid-date">Payé le {formatDate(invoice.paidAt)}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-md border" data-testid="invoice-items-table">
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
                <tr key={item.id} className="border-b last:border-0" data-testid="invoice-item-row">
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

      <div className="flex gap-4">
        <InvoiceAmountsCard amounts={amounts} />
        <InvoiceBalanceCard totalTtcCents={totalTtcCents} paidCents={paidCents} status={status} />
      </div>
    </div>
  );
}
