"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface MetricWidgetProps {
  title: string;
  value: string;
  change: number;
  positive?: boolean;
  description?: string;
}

export function MetricWidget({
  title,
  value,
  change,
  positive = true,
  description,
}: MetricWidgetProps) {
  const isGood = positive ? change >= 0 : change <= 0;
  const changeDisplay = change >= 0 ? `+${change}%` : `${change}%`;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-xl font-bold">{value}</p>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              isGood
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {changeDisplay}
          </span>
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
