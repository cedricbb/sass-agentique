import React from "react"
import Link from "next/link"
import { requireCustomer } from "@/lib/auth"
import { paymentService } from "@saas/services"
import { formatCurrency, formatDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PaymentWithInvoiceInfo } from "@saas/services/payment.service"

type PaymentMethod = PaymentWithInvoiceInfo["method"]

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  stripe_card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
  other: "Autre",
}

const PAYMENT_METHOD_VARIANT: Record<PaymentMethod, string> = {
  stripe_card: "default",
  bank_transfer: "secondary",
  other: "outline",
}

export default async function CustomerPaymentsPage() {
  const { client } = await requireCustomer()
  const payments = await paymentService.listPaymentsForCustomerPortal(client.id)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Mes paiements</h2>
      {payments.length === 0 ? (
        <Card>
          <CardContent
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="payments-empty"
          >
            Aucun paiement enregistré
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border" data-testid="payments-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Montant TTC</th>
                <th className="px-4 py-3 text-left font-medium">Méthode</th>
                <th className="px-4 py-3 text-left font-medium">Facture</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0" data-testid="payment-row">
                  <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                  <td className="px-4 py-3">{formatCurrency(payment.amountEurCents / 100) + " TTC"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={PAYMENT_METHOD_VARIANT[payment.method] as "default" | "secondary" | "outline" | "destructive"}
                      data-testid="payment-method-badge"
                    >
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/account/invoices/${payment.invoiceId}`}
                      className="font-medium text-primary hover:underline"
                      data-testid="payment-invoice-link"
                    >
                      {payment.invoiceNumber}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
