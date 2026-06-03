import React from "react"
import Link from "next/link"
import { requireCustomer } from "@/lib/auth"
import { maintenanceContractService, listPrestations } from "@saas/services"
import { formatCurrency, formatDate } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Prestation } from "@saas/db"
import { STATUS_LABELS, STATUS_VARIANT, BILLING_MODE_LABELS } from "./_lib/labels"
import type { CustomerVisibleContractStatus } from "@saas/services/maintenance-contract.shared"

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
                    <Link
                      href={`/account/contracts/${contract.id}`}
                      className="font-medium text-primary hover:underline"
                      data-testid="contract-link"
                    >
                      {prestationNames[contract.prestationId] ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={STATUS_VARIANT[contract.status as CustomerVisibleContractStatus]}
                      data-testid="contract-status-badge"
                    >
                      {STATUS_LABELS[contract.status as CustomerVisibleContractStatus]}
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
