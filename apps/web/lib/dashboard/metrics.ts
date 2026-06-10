import "server-only";

import {
  listClients,
  listInvoices,
  listAllProjects,
  paymentService,
  maintenanceContractService,
  computeInvoiceTtc,
} from "@saas/services";

export type DashboardMetrics = {
  clientsCount: number;
  activeProjectsCount: number;
  invoicedTtcCents: number;
  collectedCents: number;
  activeContractsCount: number;
  unpaidInvoicesCount: number;
  monthlyRevenue: { label: string; revenueTtcCents: number }[];
  invoiceStatusBreakdown: { status: string; count: number }[];
};

const BILLABLE_STATUSES = new Set(["sent", "paid", "overdue"]);
const UNPAID_STATUSES = new Set(["sent", "overdue"]);

const MONTH_LABELS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

const STATUS_LABELS_FR: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
}

function computeMonthlyRevenue(
  billableInvoices: Awaited<ReturnType<typeof listInvoices>>,
  now: Date,
): { label: string; revenueTtcCents: number }[] {
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: MONTH_LABELS_FR[d.getMonth()] });
  }

  const revenueByMonth = new Map<string, number>();
  for (const m of months) revenueByMonth.set(m.key, 0);

  for (const inv of billableInvoices) {
    const date = inv.issuedAt ?? inv.createdAt;
    const key = monthKey(new Date(date));
    if (revenueByMonth.has(key)) {
      const ttc = computeInvoiceTtc({ totalEurCents: inv.totalEurCents, vatRateBps: inv.vatRateBps }).totalTtcCents;
      revenueByMonth.set(key, revenueByMonth.get(key)! + ttc);
    }
  }

  return months.map((m) => ({
    label: m.label,
    revenueTtcCents: revenueByMonth.get(m.key) ?? 0,
  }));
}

function computeStatusBreakdown(
  invoices: Awaited<ReturnType<typeof listInvoices>>,
): { status: string; count: number }[] {
  const statusCounts = new Map<string, number>();
  for (const inv of invoices) {
    const label = STATUS_LABELS_FR[inv.status] ?? inv.status;
    statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
  }
  return Array.from(statusCounts.entries()).map(
    ([status, count]) => ({ status, count }),
  );
}

export async function buildDashboardMetrics(): Promise<DashboardMetrics> {
  const [clients, invoices, projects, payments, contracts] = await Promise.all([
    listClients(),
    listInvoices(),
    listAllProjects(),
    paymentService.listAllPayments({ limit: 200 }),
    maintenanceContractService.listAllContracts(),
  ]);

  const billableInvoices = invoices.filter((i) => BILLABLE_STATUSES.has(i.status));

  const invoicedTtcCents = billableInvoices.reduce(
    (sum, i) => sum + computeInvoiceTtc({ totalEurCents: i.totalEurCents, vatRateBps: i.vatRateBps }).totalTtcCents,
    0,
  );

  const collectedCents = payments.reduce((sum, p) => sum + p.amountCents, 0);

  return {
    clientsCount: clients.length,
    activeProjectsCount: projects.filter((p) => p.status === "active").length,
    invoicedTtcCents,
    collectedCents,
    activeContractsCount: contracts.filter((c) => c.status === "active").length,
    unpaidInvoicesCount: invoices.filter((i) => UNPAID_STATUSES.has(i.status)).length,
    monthlyRevenue: computeMonthlyRevenue(billableInvoices, new Date()),
    invoiceStatusBreakdown: computeStatusBreakdown(invoices),
  };
}
