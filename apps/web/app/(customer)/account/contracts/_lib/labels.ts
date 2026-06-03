import type { CustomerVisibleContractStatus } from "@saas/services/maintenance-contract.shared"
import type { MaintenanceContract } from "@saas/db"

export const STATUS_LABELS: Record<CustomerVisibleContractStatus, string> = {
  active: "Actif",
  past_due: "Paiement en attente",
  canceled: "Résilié",
}

export const STATUS_VARIANT: Record<CustomerVisibleContractStatus, "success" | "destructive" | "secondary"> = {
  active: "success",
  past_due: "destructive",
  canceled: "secondary",
}

export const BILLING_MODE_LABELS: Record<MaintenanceContract["billingMode"], string> = {
  stripe_auto: "Stripe (auto)",
  manual_invoice: "Facturation manuelle",
}
