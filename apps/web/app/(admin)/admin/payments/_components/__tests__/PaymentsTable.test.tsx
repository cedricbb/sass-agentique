// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { PaymentsTable } from "../PaymentsTable";
import type { Payment } from "@saas/db";

afterEach(() => cleanup());

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

const CLIENT_NAMES: Record<string, string> = {
  "inv-1": "Acme Corp",
  "inv-2": "Beta SAS",
};

const INVOICE_NUMBERS: Record<string, string> = {
  "inv-1": "INV-2026-001",
  "inv-2": "INV-2026-002",
};

const mockPayments: Payment[] = [
  {
    id: "pay-1",
    invoiceId: "inv-1",
    amountEurCents: 10000,
    method: "stripe_card",
    externalRef: "pi_test_001",
    paidAt: new Date("2026-04-15T10:00:00Z"),
    notes: null,
    createdAt: new Date("2026-04-15T10:00:00Z"),
  },
  {
    id: "pay-2",
    invoiceId: "inv-2",
    amountEurCents: 5000,
    method: "bank_transfer",
    externalRef: null,
    paidAt: new Date("2026-03-20T10:00:00Z"),
    notes: null,
    createdAt: new Date("2026-03-20T10:00:00Z"),
  },
  {
    id: "pay-3-abcdef12",
    invoiceId: "inv-unknown",
    amountEurCents: 8000,
    method: "other",
    externalRef: null,
    paidAt: new Date("2026-05-01T10:00:00Z"),
    notes: null,
    createdAt: new Date("2026-05-01T10:00:00Z"),
  },
] as Payment[];

describe("PaymentsTable", () => {
  it("renders table with data", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    expect(screen.getByText("pi_test_001")).toBeInTheDocument();
  });

  it("displays all expected columns", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    expect(screen.getByText("Référence")).toBeInTheDocument();
    expect(screen.getByText("Facture")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Méthode")).toBeInTheDocument();
  });

  it("search input present with correct testid", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    const input = screen.getByTestId("payments-search");
    expect(input).toBeInTheDocument();
  });

  it("lookup clientNames resolves invoiceId→name", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta SAS")).toBeInTheDocument();
  });

  it("lookup invoiceNumbers resolves invoiceId→number", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-002")).toBeInTheDocument();
  });

  it("method displays FR label", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    expect(screen.getByText("Carte Stripe")).toBeInTheDocument();
    expect(screen.getByText("Virement")).toBeInTheDocument();
    expect(screen.getByText("Autre")).toBeInTheDocument();
  });

  it("formatCurrency formats amount", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    const matches = screen.getAllByText("100,00 €");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("action link points to /admin/invoices/[invoiceId]", () => {
    renderWithNuqs(
      <PaymentsTable data={mockPayments} clientNames={CLIENT_NAMES} invoiceNumbers={INVOICE_NUMBERS} />,
    );
    const link = screen.getByTestId("payment-view-pay-1");
    expect(link).toHaveAttribute("href", "/admin/invoices/inv-1");
  });
});
