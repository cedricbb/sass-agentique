// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("@/lib/dashboard/metrics", () => ({
  buildDashboardMetrics: vi.fn(),
}));

vi.mock("@/components/dashboard/MonthlyRevenueChart", () => ({
  MonthlyRevenueChart: (_props: any) =>
    React.createElement("div", { "data-testid": "revenue-chart" }),
}));

vi.mock("@/components/dashboard/InvoiceStatusBreakdownChart", () => ({
  InvoiceStatusBreakdownChart: (_props: any) =>
    React.createElement("div", { "data-testid": "breakdown-chart" }),
}));

import { render } from "@testing-library/react";
import { buildDashboardMetrics } from "@/lib/dashboard/metrics";
import AdminDashboardPage from "../page";

const mockBuild = vi.mocked(buildDashboardMetrics);

const MOCK_METRICS = {
  clientsCount: 5,
  activeProjectsCount: 3,
  invoicedTtcCents: 120000,
  collectedCents: 80000,
  activeContractsCount: 2,
  unpaidInvoicesCount: 4,
  monthlyRevenue: [{ label: "Mai", revenueTtcCents: 120000 }],
  invoiceStatusBreakdown: [{ status: "Envoyée", count: 2 }],
};

describe("AdminDashboardPage", () => {
  it("calls buildDashboardMetrics", async () => {
    mockBuild.mockResolvedValue(MOCK_METRICS);
    const Page = await AdminDashboardPage();
    render(Page);
    expect(mockBuild).toHaveBeenCalledOnce();
  });

  it("does NOT import getAdminStats", async () => {
    const pageSource = await import("../page");
    expect((pageSource as any).getAdminStats).toBeUndefined();
  });

  it("renders 6 StatCard titles", async () => {
    mockBuild.mockResolvedValue(MOCK_METRICS);
    const Page = await AdminDashboardPage();
    const { container } = render(Page);
    const titles = ["Clients", "Projets actifs", "CA facturé TTC", "CA encaissé", "Contrats actifs", "Factures en attente"];
    for (const t of titles) {
      expect(container.textContent).toContain(t);
    }
  });
});
