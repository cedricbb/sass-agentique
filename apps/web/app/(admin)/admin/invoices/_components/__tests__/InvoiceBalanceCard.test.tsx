// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InvoiceBalanceCard } from "../InvoiceBalanceCard";

afterEach(cleanup);

describe("InvoiceBalanceCard", () => {
  it("T1 — renders card with data-testid", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={0} status="sent" />);
    expect(screen.getByTestId("invoice-balance-card")).toBeInTheDocument();
  });

  it("T2 — displays remaining with data-testid", () => {
    render(<InvoiceBalanceCard totalTtcCents={20000} paidCents={5000} status="sent" />);
    expect(screen.getByTestId("invoice-balance-remaining")).toBeInTheDocument();
    expect(screen.getByText(/150,00\s?€/)).toBeInTheDocument();
  });

  it("T3 — badge Payée when status=paid", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={0} status="paid" />);
    const badge = screen.getByTestId("invoice-balance-badge");
    expect(badge).toHaveTextContent("Payée");
  });

  it("T4 — badge Soldée when remaining=0 and status=sent", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={10000} status="sent" />);
    const badge = screen.getByTestId("invoice-balance-badge");
    expect(badge).toHaveTextContent("Soldée");
  });

  it("T5 — badge En retard when status=overdue", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={5000} status="overdue" />);
    const badge = screen.getByTestId("invoice-balance-badge");
    expect(badge).toHaveTextContent("En retard");
  });

  it("T6 — badge Reste à payer for sent with remaining > 0", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={3000} status="sent" />);
    const badge = screen.getByTestId("invoice-balance-badge");
    expect(badge).toHaveTextContent("Reste à payer");
  });

  it("T7 — Math.max(0) prevents negative remaining on overpayment", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={15000} status="sent" />);
    const badge = screen.getByTestId("invoice-balance-badge");
    expect(badge).toHaveTextContent("Soldée");
    expect(screen.getByText(/^0,00\s?€/)).toBeInTheDocument();
  });

  it("T8 — paid status takes priority over remaining=0", () => {
    render(<InvoiceBalanceCard totalTtcCents={10000} paidCents={10000} status="paid" />);
    const badge = screen.getByTestId("invoice-balance-badge");
    expect(badge).toHaveTextContent("Payée");
  });

  it("T9 — formats Total TTC and Déjà payé correctly", () => {
    render(<InvoiceBalanceCard totalTtcCents={30000} paidCents={5000} status="sent" />);
    expect(screen.getByText("Total TTC")).toBeInTheDocument();
    expect(screen.getByText("Déjà payé")).toBeInTheDocument();
    expect(screen.getByText(/300,00\s?€/)).toBeInTheDocument();
    expect(screen.getByText(/^50,00\s?€/)).toBeInTheDocument();
  });
});
