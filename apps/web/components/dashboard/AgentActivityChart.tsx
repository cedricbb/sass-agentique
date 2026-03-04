"use client";

import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const data = [
  { day: "Lun", success: 142, error: 8 },
  { day: "Mar", success: 198, error: 12 },
  { day: "Mer", success: 167, error: 5 },
  { day: "Jeu", success: 215, error: 18 },
  { day: "Ven", success: 189, error: 7 },
  { day: "Sam", success: 98, error: 3 },
  { day: "Dim", success: 76, error: 2 },
];

interface TooltipPayload {
  dataKey: string;
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

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-card-foreground">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey === "success" ? "Succès" : "Erreurs"} :
          </span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
      <div className="mt-2 border-t pt-2 text-sm">
        <span className="text-muted-foreground">Total :</span>{" "}
        <span className="font-semibold">{total}</span>
      </div>
    </div>
  );
}

export function AgentActivityChart() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Activité des Agents</CardTitle>
        <CardDescription>7 derniers jours</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar
              dataKey="success"
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
              name="Succès"
              stackId="stack"
            />
            <Bar
              dataKey="error"
              fill="var(--color-destructive)"
              radius={[4, 4, 0, 0]}
              name="Erreurs"
              stackId="stack"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
