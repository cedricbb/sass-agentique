"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyRevenueChartProps {
  data: { label: string; revenueTtcCents: number }[];
}

export function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée de revenu
      </div>
    );
  }

  const chartData = data.map((d) => ({
    label: d.label,
    revenueTtc: d.revenueTtcCents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip
          formatter={(value: number | undefined) =>
            new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value ?? 0)
          }
        />
        <Bar dataKey="revenueTtc" name="CA TTC" fill="#7c3aed" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
