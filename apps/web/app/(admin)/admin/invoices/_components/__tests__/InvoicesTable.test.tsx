// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { InvoicesTable } from "../InvoicesTable";
import type { Invoice } from "@saas/db";

afterEach(() => cleanup());

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

const CLIENT_NAMES: Record<string, string> = {
  "c-acme": "Acme Corp",
  "c-beta": "Beta SAS",
};

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    clientId: "c-acme",
    quoteId: null,
    projectId: null,
    number: "INV-2026-001",
    status: "draft",
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    totalEurCents: 25000,
    vatRateBps: 2000,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    notes: null,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    updatedAt: new Date("2026-01-15T10:00:00Z"),
  },
  {
    id: "inv-2",
    clientId: "c-beta",
    quoteId: null,
    projectId: null,
    number: "INV-2026-002",
    status: "sent",
    issuedAt: new Date("2026-03-15T09:00:00Z"),
    dueAt: new Date("2026-04-15T09:00:00Z"),
    paidAt: null,
    totalEurCents: 25000,
    vatRateBps: 2000,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    notes: null,
    createdAt: new Date("2026-03-15T09:00:00Z"),
    updatedAt: new Date("2026-03-15T09:00:00Z"),
  },
  {
    id: "inv-3",
    clientId: "c-unknown",
    quoteId: null,
    projectId: null,
    number: "INV-2026-003",
    status: "paid",
    issuedAt: new Date("2026-02-01T09:00:00Z"),
    dueAt: new Date("2026-03-01T09:00:00Z"),
    paidAt: new Date("2026-02-20T09:00:00Z"),
    totalEurCents: 5000,
    vatRateBps: 2000,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    notes: null,
    createdAt: new Date("2026-02-01T09:00:00Z"),
    updatedAt: new Date("2026-02-20T09:00:00Z"),
  },
] as Invoice[];

describe("InvoicesTable", () => {
  it("renders invoice rows", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-002")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-003")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithNuqs(<InvoicesTable data={[]} clientNames={CLIENT_NAMES} />);
    expect(screen.getByText("Aucun résultat trouvé.")).toBeInTheDocument();
  });

  it("displays client names via lookup", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta SAS")).toBeInTheDocument();
  });

  it("renders French badge labels for statuses", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getByText("Émise")).toBeInTheDocument();
    expect(screen.getByText("Payée")).toBeInTheDocument();
  });

  it("shows fallback dash for unknown clientId", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows fallback dash for null issuedAt and dueAt", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("formats Montant TTC correctly", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    const matches = screen.getAllByText("300,00 €");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("has search input with correct placeholder and testid", () => {
    renderWithNuqs(
      <InvoicesTable data={mockInvoices} clientNames={CLIENT_NAMES} />,
    );
    const input = screen.getByTestId("invoices-search");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute(
      "placeholder",
      "Rechercher une facture...",
    );
  });
});
