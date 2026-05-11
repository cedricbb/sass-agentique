import { Users, Bot, Activity } from "lucide-react";
import { getAdminStats } from "@saas/services";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de la plateforme
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Utilisateurs Total"
          value={stats.totalUsers.toLocaleString("fr-FR")}
          trend={0}
          trendLabel="actifs"
          icon={Users}
          iconBg="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Tâches Agent"
          value={stats.totalAgentTasks.toLocaleString("fr-FR")}
          trend={0}
          trendLabel="total"
          icon={Bot}
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Utilisateurs Bannis"
          value={stats.bannedUsers.toLocaleString("fr-FR")}
          trend={0}
          trendLabel={`sur ${stats.totalUsers}`}
          icon={Activity}
          iconBg="bg-red-100 text-red-600"
        />
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilisateurs Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.activeUsers.toLocaleString("fr-FR")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.totalUsers > 0
                ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
                : 0}
              % de l&apos;effectif total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tâches en Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {stats.pendingAgentTasks.toLocaleString("fr-FR")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              tâches agents à traiter
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
