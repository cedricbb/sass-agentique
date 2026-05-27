import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client, Invoice, Project, Payment, MaintenanceContract } from "@saas/db";

vi.mock("server-only", () => ({}));

vi.mock("@saas/services", () => ({
  listClients: vi.fn(),
  listInvoices: vi.fn(),
  listAllProjects: vi.fn(),
  paymentService: {
    listAllPayments: vi.fn(),
  },
  maintenanceContractService: {
    listAllContracts: vi.fn(),
  },
  computeInvoiceTtc: vi.fn(),
}));

import { buildDashboardMetrics } from "../metrics";
import {
  listClients,
  listInvoices,
  listAllProjects,
  paymentService,
  maintenanceContractService,
  computeInvoiceTtc,
} from "@saas/services";

const mockListClients = vi.mocked(listClients);
const mockListInvoices = vi.mocked(listInvoices);
const mockListAllProjects = vi.mocked(listAllProjects);
const mockListAllPayments = vi.mocked(paymentService.listAllPayments);
const mockListAllContracts = vi.mocked(maintenanceContractService.listAllContracts);
const mockComputeInvoiceTtc = vi.mocked(computeInvoiceTtc);

function resetAll() {
  mockListClients.mockResolvedValue([]);
  mockListInvoices.mockResolvedValue([]);
  mockListAllProjects.mockResolvedValue([]);
  mockListAllPayments.mockResolvedValue([]);
  mockListAllContracts.mockResolvedValue([]);
  mockComputeInvoiceTtc.mockImplementation((inv: { totalEurCents: number; vatRateBps: number }) => {
    const totalHtCents = inv.totalEurCents;
    const vatCents = Math.round((totalHtCents * inv.vatRateBps) / 10000);
    return { totalHtCents, vatCents, totalTtcCents: totalHtCents + vatCents };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAll();
});

describe("buildDashboardMetrics", () => {
  it("returns clientsCount from listClients length", async () => {
    mockListClients.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }] as unknown as Client[]);
    const m = await buildDashboardMetrics();
    expect(m.clientsCount).toBe(3);
  });

  it("returns activeProjectsCount filtering by status=active", async () => {
    mockListAllProjects.mockResolvedValue([
      { id: "1", status: "active" },
      { id: "2", status: "active" },
      { id: "3", status: "draft" },
      { id: "4", status: "delivered" },
    ] as unknown as Project[]);
    const m = await buildDashboardMetrics();
    expect(m.activeProjectsCount).toBe(2);
  });

  it("computes invoicedTtcCents with VAT for sent/paid/overdue only", async () => {
    mockListInvoices.mockResolvedValue([
      { id: "1", status: "sent", totalEurCents: 10000, vatRateBps: 2000, issuedAt: new Date(), createdAt: new Date() },
      { id: "2", status: "paid", totalEurCents: 5000, vatRateBps: 2000, issuedAt: new Date(), createdAt: new Date() },
      { id: "3", status: "draft", totalEurCents: 9999, vatRateBps: 2000, issuedAt: null, createdAt: new Date() },
      { id: "4", status: "cancelled", totalEurCents: 9999, vatRateBps: 2000, issuedAt: null, createdAt: new Date() },
    ] as unknown as Invoice[]);
    const m = await buildDashboardMetrics();
    expect(m.invoicedTtcCents).toBe(12000 + 6000);
  });

  it("excludes draft and cancelled from invoicedTtcCents", async () => {
    mockListInvoices.mockResolvedValue([
      { id: "1", status: "draft", totalEurCents: 10000, vatRateBps: 2000, issuedAt: null, createdAt: new Date() },
      { id: "2", status: "cancelled", totalEurCents: 5000, vatRateBps: 0, issuedAt: null, createdAt: new Date() },
    ] as unknown as Invoice[]);
    const m = await buildDashboardMetrics();
    expect(m.invoicedTtcCents).toBe(0);
  });

  it("computes collectedCents from payments sum", async () => {
    mockListAllPayments.mockResolvedValue([
      { id: "1", amountEurCents: 5000 },
      { id: "2", amountEurCents: 3000 },
    ] as unknown as Payment[]);
    const m = await buildDashboardMetrics();
    expect(m.collectedCents).toBe(8000);
  });

  it("returns activeContractsCount filtering by status=active", async () => {
    mockListAllContracts.mockResolvedValue([
      { id: "1", status: "active" },
      { id: "2", status: "active" },
      { id: "3", status: "canceled" },
      { id: "4", status: "past_due" },
    ] as unknown as MaintenanceContract[]);
    const m = await buildDashboardMetrics();
    expect(m.activeContractsCount).toBe(2);
  });

  it("returns unpaidInvoicesCount for sent and overdue", async () => {
    mockListInvoices.mockResolvedValue([
      { id: "1", status: "sent", totalEurCents: 100, vatRateBps: 0, issuedAt: new Date(), createdAt: new Date() },
      { id: "2", status: "overdue", totalEurCents: 100, vatRateBps: 0, issuedAt: new Date(), createdAt: new Date() },
      { id: "3", status: "paid", totalEurCents: 100, vatRateBps: 0, issuedAt: new Date(), createdAt: new Date() },
      { id: "4", status: "draft", totalEurCents: 100, vatRateBps: 0, issuedAt: null, createdAt: new Date() },
    ] as unknown as Invoice[]);
    const m = await buildDashboardMetrics();
    expect(m.unpaidInvoicesCount).toBe(2);
  });

  it("groups monthlyRevenue by month with TTC sums for last 6 months", async () => {
    const now = new Date();
    const month0 = new Date(now.getFullYear(), now.getMonth(), 15);
    const month1 = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const month2 = new Date(now.getFullYear(), now.getMonth() - 2, 15);

    mockListInvoices.mockResolvedValue([
      { id: "1", status: "sent", totalEurCents: 10000, vatRateBps: 2000, issuedAt: month0, createdAt: month0 },
      { id: "2", status: "paid", totalEurCents: 5000, vatRateBps: 0, issuedAt: month1, createdAt: month1 },
      { id: "3", status: "sent", totalEurCents: 3000, vatRateBps: 1000, issuedAt: month2, createdAt: month2 },
    ] as unknown as Invoice[]);

    const m = await buildDashboardMetrics();
    expect(m.monthlyRevenue).toHaveLength(6);
    const lastEntry = m.monthlyRevenue[m.monthlyRevenue.length - 1];
    expect(lastEntry.revenueTtcCents).toBe(12000);
  });

  it("fills months with no invoices as revenueTtcCents=0", async () => {
    mockListInvoices.mockResolvedValue([]);
    const m = await buildDashboardMetrics();
    expect(m.monthlyRevenue).toHaveLength(6);
    m.monthlyRevenue.forEach((entry) => {
      expect(entry.revenueTtcCents).toBe(0);
    });
  });

  it("uses issuedAt for grouping, falls back to createdAt", async () => {
    const targetMonth = new Date(2026, 3, 15);
    const differentMonth = new Date(2026, 1, 15);

    mockListInvoices.mockResolvedValue([
      { id: "1", status: "sent", totalEurCents: 1000, vatRateBps: 0, issuedAt: targetMonth, createdAt: differentMonth },
    ] as unknown as Invoice[]);

    const m = await buildDashboardMetrics();
    const aprEntry = m.monthlyRevenue.find((e) => e.label === "Avr");
    if (aprEntry) {
      expect(aprEntry.revenueTtcCents).toBe(1000);
    }
  });

  it("computes invoiceStatusBreakdown counts per status", async () => {
    mockListInvoices.mockResolvedValue([
      { id: "1", status: "draft", totalEurCents: 0, vatRateBps: 0, issuedAt: null, createdAt: new Date() },
      { id: "2", status: "draft", totalEurCents: 0, vatRateBps: 0, issuedAt: null, createdAt: new Date() },
      { id: "3", status: "sent", totalEurCents: 0, vatRateBps: 0, issuedAt: new Date(), createdAt: new Date() },
      { id: "4", status: "paid", totalEurCents: 0, vatRateBps: 0, issuedAt: new Date(), createdAt: new Date() },
    ] as unknown as Invoice[]);
    const m = await buildDashboardMetrics();
    const draft = m.invoiceStatusBreakdown.find((b) => b.status === "Brouillon");
    expect(draft?.count).toBe(2);
    const sent = m.invoiceStatusBreakdown.find((b) => b.status === "Envoyée");
    expect(sent?.count).toBe(1);
  });

  it("returns all zeros and empty arrays for empty lists", async () => {
    const m = await buildDashboardMetrics();
    expect(m.clientsCount).toBe(0);
    expect(m.activeProjectsCount).toBe(0);
    expect(m.invoicedTtcCents).toBe(0);
    expect(m.collectedCents).toBe(0);
    expect(m.activeContractsCount).toBe(0);
    expect(m.unpaidInvoicesCount).toBe(0);
    expect(m.invoiceStatusBreakdown).toEqual([]);
    expect(m.monthlyRevenue).toHaveLength(6);
  });
});
