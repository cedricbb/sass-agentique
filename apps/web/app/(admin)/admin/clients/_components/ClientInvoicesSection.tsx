import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeInvoiceTtc } from "@saas/services/invoice.shared";
import type { Invoice } from "@saas/db";

const STATUS_LABELS: Record<Invoice["status"], string> = {
  draft: "Brouillon",
  sent: "Émise",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

const STATUS_BADGE_VARIANT: Record<
  Invoice["status"],
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  draft: "secondary",
  sent: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

interface ClientInvoicesSectionProps {
  invoices: Invoice[];
}

export function ClientInvoicesSection({ invoices }: ClientInvoicesSectionProps) {
  return (
    <section data-testid="client-invoices-section">
      <h2 className="text-lg font-semibold mb-4">Factures</h2>
      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune facture pour ce client.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Numéro</th>
              <th className="text-left p-2">Statut</th>
              <th className="text-left p-2">Émis le</th>
              <th className="text-left p-2">Échéance</th>
              <th className="text-left p-2">Montant TTC</th>
              <th className="text-left p-2">Payé le</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b">
                <td className="p-2">
                  <Link href={`/admin/invoices/${invoice.id}`} className="hover:underline">
                    {invoice.number}
                  </Link>
                </td>
                <td className="p-2">
                  <Badge variant={STATUS_BADGE_VARIANT[invoice.status]}>
                    {STATUS_LABELS[invoice.status]}
                  </Badge>
                </td>
                <td className="p-2">{formatDate(invoice.issuedAt)}</td>
                <td className="p-2">{formatDate(invoice.dueAt)}</td>
                <td className="p-2">
                  {formatCurrency(computeInvoiceTtc(invoice).totalTtcCents / 100)}
                </td>
                <td className="p-2">{formatDate(invoice.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
