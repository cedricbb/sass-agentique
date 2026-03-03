"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";

type Period = "7J" | "30J" | "3M" | "1A";

interface DataPoint {
  label: string;
  revenue: number;
  agents: number;
}

const DATA: Record<Period, DataPoint[]> = {
  "7J": [
    { label: "Lun", revenue: 4200, agents: 890 },
    { label: "Mar", revenue: 5100, agents: 1120 },
    { label: "Mer", revenue: 4800, agents: 980 },
    { label: "Jeu", revenue: 6300, agents: 1450 },
    { label: "Ven", revenue: 7200, agents: 1680 },
    { label: "Sam", revenue: 5500, agents: 1200 },
    { label: "Dim", revenue: 4900, agents: 950 },
  ],
  "30J": [
    { label: "Sem 1", revenue: 28500, agents: 6200 },
    { label: "Sem 2", revenue: 34200, agents: 7800 },
    { label: "Sem 3", revenue: 41000, agents: 9400 },
    { label: "Sem 4", revenue: 38700, agents: 8900 },
  ],
  "3M": [
    { label: "Janvier", revenue: 98000, agents: 22000 },
    { label: "Février", revenue: 112000, agents: 25500 },
    { label: "Mars", revenue: 127500, agents: 29000 },
  ],
  "1A": [
    { label: "Jan", revenue: 72000, agents: 16000 },
    { label: "Fév", revenue: 85000, agents: 18500 },
    { label: "Mar", revenue: 91000, agents: 20200 },
    { label: "Avr", revenue: 88000, agents: 19800 },
    { label: "Mai", revenue: 95000, agents: 21500 },
    { label: "Jun", revenue: 103000, agents: 23400 },
    { label: "Jul", revenue: 98000, agents: 22100 },
    { label: "Aoû", revenue: 87000, agents: 19500 },
    { label: "Sep", revenue: 104000, agents: 23900 },
    { label: "Oct", revenue: 112000, agents: 25600 },
    { label: "Nov", revenue: 118000, agents: 27200 },
    { label: "Déc", revenue: 127000, agents: 29100 },
  ],
};

function formatRevenue(value: number): string {
  if (value >= 1000) {
    return `€${(value / 1000).toFixed(0)}k`;
  }
  return `€${value}`;
}

interface TooltipPayload {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white p-3 shadow-md">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey === "revenue" ? "Revenus" : "Tâches agents"} :
          </span>
          <span className="font-medium">
            {entry.dataKey === "revenue"
              ? `€${entry.value.toLocaleString("fr-FR")}`
              : entry.value.toLocaleString("fr-FR")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>("30J");
  const data = DATA[period];

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Revenus & Activité</CardTitle>
            <CardDescription className="mt-1">
              Évolution sur la période
            </CardDescription>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorAgents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatRevenue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }}
              formatter={(value: string) =>
                value === "revenue" ? "Revenus (€)" : "Tâches agents"
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#colorRevenue)"
              name="revenue"
            />
            <Area
              type="monotone"
              dataKey="agents"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorAgents)"
              name="agents"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
