import React from "react";
import { Users, Briefcase, Euro, CreditCard, FileCheck, FileText } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { InvoiceStatusBreakdownChart } from "@/components/dashboard/InvoiceStatusBreakdownChart";
import { buildDashboardMetrics } from "@/lib/dashboard/metrics";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const metrics = await buildDashboardMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de la plateforme
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Clients"
          value={metrics.clientsCount.toString()}
          trend={0}
          icon={Users}
          iconBg="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Projets actifs"
          value={metrics.activeProjectsCount.toString()}
          trend={0}
          icon={Briefcase}
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="CA facturé TTC"
          value={formatCurrency(metrics.invoicedTtcCents / 100)}
          trend={0}
          icon={Euro}
          iconBg="bg-violet-100 text-violet-600"
        />
        <StatCard
          title="CA encaissé"
          value={formatCurrency(metrics.collectedCents / 100)}
          trend={0}
          icon={CreditCard}
          iconBg="bg-amber-100 text-amber-600"
        />
        <StatCard
          title="Contrats actifs"
          value={metrics.activeContractsCount.toString()}
          trend={0}
          icon={FileCheck}
          iconBg="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          title="Factures en attente"
          value={metrics.unpaidInvoicesCount.toString()}
          trend={0}
          icon={FileText}
          iconBg="bg-red-100 text-red-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenu mensuel TTC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyRevenueChart data={metrics.monthlyRevenue} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Répartition des factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InvoiceStatusBreakdownChart data={metrics.invoiceStatusBreakdown} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
