// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

(globalThis as Record<string, unknown>).React = React;

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@saas/services", () => ({
  getInvoiceById: vi.fn(),
  listClients: vi.fn().mockResolvedValue([]),
  listAllProjects: vi.fn().mockResolvedValue([]),
  listPrestations: vi.fn().mockResolvedValue([]),
  getQuoteById: vi.fn().mockResolvedValue(null),
  listInvoiceItems: vi.fn().mockResolvedValue([]),
  paymentService: {
    computeInvoiceBalance: vi.fn().mockResolvedValue({ paidCents: 5000 }),
    listPaymentsByInvoice: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@saas/services/invoice.shared", () => ({
  computeInvoiceTtc: vi.fn().mockReturnValue({ totalHtCents: 10000, vatCents: 2000, totalTtcCents: 12000 }),
}));

const MOCK_INVOICE_BASE = {
  id: "inv-1",
  number: "INV-2024-001",
  totalEurCents: 10000,
  vatRate: 20,
  quoteId: null,
};

vi.mock("../../_components/InvoiceStatusActions", () => ({
  InvoiceStatusActions: () => <div data-testid="mock-status-actions" />,
}));
vi.mock("../../_components/InvoiceForm", () => ({
  InvoiceForm: () => <div data-testid="mock-form" />,
}));
vi.mock("../../_components/InvoiceItemsEditor", () => ({
  InvoiceItemsEditor: () => <div data-testid="mock-items-editor" />,
}));
vi.mock("../../_components/InvoiceAmountsCard", () => ({
  InvoiceAmountsCard: () => <div data-testid="mock-amounts-card" />,
}));
vi.mock("../../_components/InvoiceBalanceCard", () => ({
  InvoiceBalanceCard: () => <div data-testid="mock-balance-card" />,
}));
vi.mock("../../_components/RecordPaymentDialog", () => ({
  RecordPaymentDialog: (props: { invoiceId: string }) => (
    <div data-testid="record-payment-button" data-invoice-id={props.invoiceId} />
  ),
}));
vi.mock("../../_components/InvoicePaymentsList", () => ({
  InvoicePaymentsList: () => <div data-testid="mock-payments-list" />,
}));

import { getInvoiceById } from "@saas/services";

afterEach(cleanup);

async function renderPage(invoice: Record<string, unknown>) {
  (getInvoiceById as ReturnType<typeof vi.fn>).mockResolvedValue(invoice);
  const EditInvoicePage = (await import("../page")).default;
  const result = render(await EditInvoicePage({ params: Promise.resolve({ id: "inv-1" }) }));
  return result;
}

describe("EditInvoicePage — RecordPaymentDialog integration", () => {
  it("Page-T1 — shows RecordPaymentDialog when invoice status is sent", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "sent" });
    expect(screen.getByTestId("record-payment-button")).toBeInTheDocument();
  });

  it("Page-T2 — hides RecordPaymentDialog when invoice status is draft", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "draft" });
    expect(screen.queryByTestId("record-payment-button")).not.toBeInTheDocument();
  });

  it("Page-T3 — hides RecordPaymentDialog when invoice status is paid", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "paid" });
    expect(screen.queryByTestId("record-payment-button")).not.toBeInTheDocument();
  });
});

describe("EditInvoicePage — InvoicePaymentsList integration", () => {
  it("P1 — renders InvoicePaymentsList when status is sent", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "sent" });
    expect(screen.getByTestId("mock-payments-list")).toBeInTheDocument();
  });

  it("P2 — renders InvoicePaymentsList when status is overdue", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "overdue" });
    expect(screen.getByTestId("mock-payments-list")).toBeInTheDocument();
  });

  it("P3 — renders InvoicePaymentsList when status is paid", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "paid" });
    expect(screen.getByTestId("mock-payments-list")).toBeInTheDocument();
  });

  it("P4 — does NOT render InvoicePaymentsList when status is draft", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "draft" });
    expect(screen.queryByTestId("mock-payments-list")).not.toBeInTheDocument();
  });

  it("P5 — does NOT render InvoicePaymentsList when status is cancelled", async () => {
    await renderPage({ ...MOCK_INVOICE_BASE, status: "cancelled" });
    expect(screen.queryByTestId("mock-payments-list")).not.toBeInTheDocument();
  });
});
