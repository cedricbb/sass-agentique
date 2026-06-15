// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClientInvoicesSection } from "../ClientInvoicesSection";
import type { Invoice } from "@saas/db";

afterEach(() => cleanup());

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    clientId: "c-acme",
    projectId: null,
    quoteId: null,
    number: "FACT-2026-001",
    status: "sent",
    issuedAt: new Date("2026-02-01T09:00:00Z"),
    dueAt: new Date("2026-03-01T09:00:00Z"),
    paidAt: null,
    totalEurCents: 10000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date("2026-02-01T09:00:00Z"),
    updatedAt: new Date("2026-02-01T09:00:00Z"),
  },
  {
    id: "inv-2",
    clientId: "c-acme",
    projectId: null,
    quoteId: null,
    number: "FACT-2026-002",
    status: "paid",
    issuedAt: new Date("2026-03-01T09:00:00Z"),
    dueAt: new Date("2026-04-01T09:00:00Z"),
    paidAt: new Date("2026-03-15T09:00:00Z"),
    totalEurCents: 20000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date("2026-03-01T09:00:00Z"),
    updatedAt: new Date("2026-03-15T09:00:00Z"),
  },
] as Invoice[];

describe("ClientInvoicesSection", () => {
  it("renders_invoice_rows", () => {
    render(<ClientInvoicesSection invoices={mockInvoices} />);
    expect(screen.getByTestId("client-invoices-section")).toBeInTheDocument();
    expect(screen.getByText("FACT-2026-001")).toBeInTheDocument();
    expect(screen.getByText("FACT-2026-002")).toBeInTheDocument();
    expect(screen.getByText("Émise")).toBeInTheDocument();
    expect(screen.getByText("Payée")).toBeInTheDocument();
    const inv1Link = screen.getByText("FACT-2026-001").closest("a");
    expect(inv1Link).toHaveAttribute("href", "/admin/invoices/inv-1");
  });

  it("renders_empty_state_when_no_invoices", () => {
    render(<ClientInvoicesSection invoices={[]} />);
    expect(screen.getByText("Aucune facture pour ce client.")).toBeInTheDocument();
  });
});
