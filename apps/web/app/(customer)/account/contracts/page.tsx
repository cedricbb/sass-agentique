import React from "react"
import { requireCustomer } from "@/lib/auth"
import { maintenanceContractService, listPrestations } from "@saas/services"
import { formatCurrency, formatDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Prestation } from "@saas/db"

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  past_due: "Paiement en attente",
}

const STATUS_VARIANT: Record<string, string> = {
  active: "success",
  past_due: "destructive",
}

const BILLING_MODE_LABELS: Record<string, string> = {
  stripe_auto: "Stripe (auto)",
  manual_invoice: "Facturation manuelle",
}

function buildPrestationNameMap(prestations: Prestation[]): Record<string, string> {
  return Object.fromEntries(prestations.map((p) => [p.id, p.name]))
}

export default async function CustomerContractsPage() {
  const { client } = await requireCustomer()
  const [contracts, prestations] = await Promise.all([
    maintenanceContractService.listContractsForCustomerPortal(client.id),
    listPrestations(),
  ])
  const prestationNames = buildPrestationNameMap(prestations)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Mes contrats</h2>
      {contracts.length === 0 ? (
        <Card>
          <CardContent
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="contracts-empty"
          >
            Aucun contrat actif
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border" data-testid="contracts-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Prestation</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Mode facturation</th>
                <th className="px-4 py-3 text-left font-medium">Prix mensuel</th>
                <th className="px-4 py-3 text-left font-medium">Depuis le</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id} className="border-b last:border-0" data-testid="contract-row">
                  <td className="px-4 py-3">
                    {prestationNames[contract.prestationId] ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={STATUS_VARIANT[contract.status] as "success" | "destructive"}
                      data-testid="contract-status-badge"
                    >
                      {STATUS_LABELS[contract.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {BILLING_MODE_LABELS[contract.billingMode]}
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(contract.monthlyPriceEurCents / 100) + " / mois HT"}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(contract.startedAt)}
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
