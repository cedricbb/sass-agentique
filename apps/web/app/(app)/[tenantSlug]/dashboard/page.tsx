import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@saas/services";
import { DollarSign, Users, Activity, Bot } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { AgentActivityChart } from "@/components/dashboard/AgentActivityChart";
import { MetricWidget } from "@/components/dashboard/MetricWidget";
import { RecentActivityTable } from "@/components/dashboard/RecentActivityTable";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d&apos;ensemble de votre activité
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            7 jours
          </button>
          <button className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            30 jours
          </button>
          <button className="inline-flex items-center rounded-lg border border-amber-500 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors">
            Ce mois
          </button>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Revenu Mensuel (MRR)"
          value="€8 240"
          trend={12.5}
          icon={DollarSign}
          iconBg="bg-amber-100 text-amber-600"
        />
        <StatCard
          title="Utilisateurs Actifs"
          value="342"
          trend={8.2}
          icon={Users}
          iconBg="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Taux de Rétention"
          value="94.2%"
          trend={1.3}
          icon={Activity}
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Tâches Exécutées"
          value="12 847"
          trend={23.8}
          icon={Bot}
          iconBg="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="lg:col-span-1">
          <AgentActivityChart />
        </div>
      </div>

      {/* Metric widgets row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricWidget
          title="Taux de Conversion"
          value="3.24%"
          change={0.8}
          description="Visiteurs → Clients"
        />
        <MetricWidget
          title="Taux de Churn"
          value="5.8%"
          change={-0.7}
          positive={false}
          description="Désabonnements ce mois"
        />
        <MetricWidget
          title="Ticket Moyen"
          value="€24 /mois"
          change={2.1}
          description="ARR par client"
        />
      </div>

      {/* Recent activity table — full width */}
      <RecentActivityTable />
    </div>
  );
}
