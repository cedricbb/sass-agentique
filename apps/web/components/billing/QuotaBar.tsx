import { cn } from "@/lib/utils";
import { getQuotaPercent, getQuotaVariant } from "./billing-utils";

export function QuotaBar({ label, current, max, unit, threshold = 80 }: {
  label: string;
  current: number;
  max: number;
  unit?: string;
  threshold?: number;
}) {
  if (max === -1) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span className="text-muted-foreground">Illimité</span>
        </div>
      </div>
    );
  }

  const pct = getQuotaPercent(current, max);
  const variant = getQuotaVariant(current, max, threshold);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {current.toLocaleString("fr-FR")} / {max.toLocaleString("fr-FR")} {unit ?? ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            variant === "warning" ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
