import { Badge } from "@/components/ui/badge";
import type { PlanId } from "@saas/config";
import { getPlanBadgeVariant, getStatusLabel, type SubscriptionStatus } from "./billing-utils";

export function PlanBadge({ planId, status }: { planId: PlanId; status?: SubscriptionStatus }) {
  if (!status || status === "active") {
    return <Badge variant="default">{planId === "free" ? "Free" : planId === "pro" ? "Pro" : "Business"}</Badge>;
  }
  return <Badge variant={getPlanBadgeVariant(status)}>{getStatusLabel(status)}</Badge>;
}
