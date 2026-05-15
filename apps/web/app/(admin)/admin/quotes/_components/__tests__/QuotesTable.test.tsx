// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { QuotesTable } from "../QuotesTable";
import type { Quote } from "@saas/db";

afterEach(() => cleanup());

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

const CLIENT_NAMES: Record<string, string> = {
  "c-acme": "Acme Corp",
  "c-beta": "Beta SAS",
};

const mockQuotes: Quote[] = [
  {
    id: "q-1",
    clientId: "c-acme",
    projectId: null,
    number: "DEV-2026-001",
    status: "draft",
    issuedAt: null,
    expiresAt: null,
    acceptedAt: null,
    totalEurCents: 10000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    updatedAt: new Date("2026-01-15T10:00:00Z"),
  },
  {
    id: "q-2",
    clientId: "c-beta",
    projectId: null,
    number: "DEV-2026-002",
    status: "sent",
    issuedAt: new Date("2026-02-01T09:00:00Z"),
    expiresAt: new Date("2026-03-01T09:00:00Z"),
    acceptedAt: null,
    totalEurCents: 5000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date("2026-02-01T09:00:00Z"),
    updatedAt: new Date("2026-02-01T09:00:00Z"),
  },
  {
    id: "q-3",
    clientId: "c-unknown",
    projectId: null,
    number: "DEV-2026-003",
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

describe("QuotesTable", () => {
  it("renders quote rows", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("DEV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("DEV-2026-002")).toBeInTheDocument();
    expect(screen.getByText("DEV-2026-003")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithNuqs(<QuotesTable data={[]} clientNames={CLIENT_NAMES} />);
    expect(screen.getByText("Aucun résultat trouvé.")).toBeInTheDocument();
  });

  it("displays client names via lookup", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta SAS")).toBeInTheDocument();
  });

  it("renders French badge labels for statuses", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getByText("Envoyé")).toBeInTheDocument();
    expect(screen.getByText("Accepté")).toBeInTheDocument();
  });

  it("shows fallback dash for unknown clientId", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("shows fallback dash for null issuedAt", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("formats Montant TTC correctly", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("120,00 €")).toBeInTheDocument();
  });

  it("has search input with correct placeholder and testid", () => {
    renderWithNuqs(
      <QuotesTable data={mockQuotes} clientNames={CLIENT_NAMES} />,
    );
    const input = screen.getByTestId("quotes-search");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute(
      "placeholder",
      "Rechercher un devis...",
    );
  });
});
