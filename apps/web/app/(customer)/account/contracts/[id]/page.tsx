import React from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { requireCustomer } from "@/lib/auth"
import { maintenanceContractService, listPrestations } from "@saas/services"
import {
  CUSTOMER_VISIBLE_CONTRACT_STATUSES,
  computeContractBilledAmount,
} from "@saas/services/maintenance-contract.shared"
import type { CustomerVisibleContractStatus } from "@saas/services/maintenance-contract.shared"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS, STATUS_VARIANT, BILLING_MODE_LABELS } from "../_lib/labels"

export default async function CustomerContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.ReactNode> {
  const { id } = await params
  const scope = await requireCustomer()
  const contract = await maintenanceContractService.getContractByIdForClient(id, scope.client.id)
  if (!contract || !CUSTOMER_VISIBLE_CONTRACT_STATUSES.includes(contract.status as CustomerVisibleContractStatus)) {
    notFound()
  }

  const [prestations] = await Promise.all([listPrestations()])
  const prestationName = prestations.find((p) => p.id === contract.prestationId)?.name ?? "—"
  const billedAmount = computeContractBilledAmount(contract, new Date())
  const status = contract.status as CustomerVisibleContractStatus

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 data-testid="contract-detail-title" className="text-lg font-semibold">
          {prestationName}
        </h2>
        <Badge variant={STATUS_VARIANT[status]} data-testid="contract-detail-status">
          {STATUS_LABELS[status]}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Mode de facturation</dt>
          <dd>{BILLING_MODE_LABELS[contract.billingMode]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Prix mensuel</dt>
          <dd>{formatCurrency(contract.monthlyPriceEurCents / 100) + " / mois HT"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Démarré le</dt>
          <dd>{formatDate(contract.startedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Montant facturé théorique</dt>
          <dd data-testid="contract-billed-amount">
            {formatCurrency(billedAmount.billedAmountEurCents / 100) + " HT"}
          </dd>
        </div>
      </dl>
      <Link href="/account/contracts" data-testid="contract-back">
        Retour aux contrats
      </Link>
    </div>
  )
}
