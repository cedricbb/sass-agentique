// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClientQuotesSection } from "../ClientQuotesSection";
import type { Quote } from "@saas/db";

afterEach(() => cleanup());

const mockQuotes: Quote[] = [
  {
    id: "q-1",
    clientId: "c-acme",
    projectId: null,
    number: "DEV-2026-001",
    status: "sent",
    issuedAt: new Date("2026-02-01T09:00:00Z"),
    expiresAt: new Date("2026-03-01T09:00:00Z"),
    acceptedAt: null,
    totalEurCents: 10000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date("2026-02-01T09:00:00Z"),
    updatedAt: new Date("2026-02-01T09:00:00Z"),
  },
  {
    id: "q-2",
    clientId: "c-acme",
    projectId: null,
    number: "DEV-2026-002",
    status: "accepted",
    issuedAt: new Date("2026-03-01T09:00:00Z"),
    expiresAt: new Date("2026-04-01T09:00:00Z"),
    acceptedAt: new Date("2026-03-10T09:00:00Z"),
    totalEurCents: 20000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date("2026-03-01T09:00:00Z"),
    updatedAt: new Date("2026-03-10T09:00:00Z"),
  },
] as Quote[];

describe("ClientQuotesSection", () => {
  it("renders_quote_rows", () => {
    render(<ClientQuotesSection quotes={mockQuotes} />);
    expect(screen.getByTestId("client-quotes-section")).toBeInTheDocument();
    expect(screen.getByText("DEV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("DEV-2026-002")).toBeInTheDocument();
    expect(screen.getByText("Envoyé")).toBeInTheDocument();
    expect(screen.getByText("Accepté")).toBeInTheDocument();
    const q1Link = screen.getByText("DEV-2026-001").closest("a");
    expect(q1Link).toHaveAttribute("href", "/admin/quotes/q-1");
  });

  it("renders_empty_state_when_no_quotes", () => {
    render(<ClientQuotesSection quotes={[]} />);
    expect(screen.getByText("Aucun devis pour ce client.")).toBeInTheDocument();
  });
});
