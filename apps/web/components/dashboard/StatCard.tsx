import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  trend: number;
  trendLabel?: string;
  icon: React.ElementType;
  iconBg: string;
}

export function StatCard({
  title,
  value,
  trend,
  trendLabel = "vs mois dernier",
  icon: Icon,
  iconBg,
}: StatCardProps) {
  const isPositive = trend >= 0;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn("flex items-center justify-center rounded-lg p-2", iconBg)}>
            <Icon className="size-5" />
          </div>
        </div>

        <p className="mt-2 text-3xl font-bold">{value}</p>

        <div className="mt-3 flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="size-4 text-emerald-500" />
          ) : (
            <TrendingDown className="size-4 text-red-500" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}
          >
            {isPositive ? "+" : ""}
            {trend}%
          </span>
          <span className="text-sm text-muted-foreground">{trendLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
