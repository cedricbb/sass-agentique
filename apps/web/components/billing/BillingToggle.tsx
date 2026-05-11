"use client";

import { Button } from "@/components/ui/button";
import type { BillingPeriod } from "./billing-utils";

export function BillingToggle({ period, onChange }: { period: BillingPeriod; onChange: (p: BillingPeriod) => void }) {
  return (
    <div className="inline-flex rounded-lg border p-1 gap-1">
      <Button
        variant={period === "monthly" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("monthly")}
      >
        Mensuel
      </Button>
      <Button
        variant={period === "yearly" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("yearly")}
      >
        Annuel
      </Button>
    </div>
  );
}
