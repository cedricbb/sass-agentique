"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeTenantPlanAction } from "@/app/actions/admin";

const PLANS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
];

interface TenantPlanSelectProps {
  tenantId: string;
  currentPlan: string;
}

export function TenantPlanSelect({ tenantId, currentPlan }: TenantPlanSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticPlan, setOptimisticPlan] = useState(currentPlan);

  function handleSelect(plan: string) {
    if (plan === optimisticPlan) return;
    setOptimisticPlan(plan);
    startTransition(async () => {
      await changeTenantPlanAction(tenantId, plan);
      router.refresh();
    });
  }

  const currentLabel = PLANS.find((p) => p.value === optimisticPlan)?.label ?? optimisticPlan;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronsUpDown className="size-3 opacity-50" />
          )}
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PLANS.map((plan) => (
          <DropdownMenuItem key={plan.value} onClick={() => handleSelect(plan.value)}>
            <Check
              className={cn(
                "mr-2 size-3.5",
                plan.value === optimisticPlan ? "opacity-100" : "opacity-0",
              )}
            />
            {plan.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
