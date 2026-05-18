// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InvoiceAmountsCard } from "../InvoiceAmountsCard";

afterEach(cleanup);

describe("InvoiceAmountsCard", () => {
  it("T1 — renders card with data-testid", () => {
    render(
      <InvoiceAmountsCard amounts={{ totalHtCents: 10000, vatCents: 2000, totalTtcCents: 12000 }} />,
    );
    expect(screen.getByTestId("invoice-amounts-card")).toBeInTheDocument();
  });

  it("T2 — displays header Montants", () => {
    render(
      <InvoiceAmountsCard amounts={{ totalHtCents: 10000, vatCents: 2000, totalTtcCents: 12000 }} />,
    );
    expect(screen.getByText("Montants")).toBeInTheDocument();
  });

  it("T3 — formats amounts correctly", () => {
    render(
      <InvoiceAmountsCard amounts={{ totalHtCents: 25000, vatCents: 5000, totalTtcCents: 30000 }} />,
    );
    expect(screen.getByText("Total HT")).toBeInTheDocument();
    expect(screen.getByText("TVA")).toBeInTheDocument();
    expect(screen.getByText("Total TTC")).toBeInTheDocument();
    expect(screen.getByText(/250,00\s?€/)).toBeInTheDocument();
    expect(screen.getByText(/^50,00\s?€/)).toBeInTheDocument();
    expect(screen.getByText(/300,00\s?€/)).toBeInTheDocument();
  });

  it("T4 — handles zero amounts", () => {
    render(
      <InvoiceAmountsCard amounts={{ totalHtCents: 0, vatCents: 0, totalTtcCents: 0 }} />,
    );
    const zeros = screen.getAllByText(/0,00/);
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });
});
