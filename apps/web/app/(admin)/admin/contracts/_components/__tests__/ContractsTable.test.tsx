// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { ContractsTable } from "../ContractsTable";

vi.mock("@/app/actions/contracts", () => ({
  cancelContractAction: vi.fn(),
}));

afterEach(() => cleanup());

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

const CLIENT_NAMES: Record<string, string> = {
  "client-acme": "Acme Studio",
  "client-bob": "Bob Indep",
  "client-globex": "Globex",
};

const PRESTATION_NAMES: Record<string, string> = {
  "prest-1": "Maintenance mensuelle",
};

const mockContracts = [
  {
    id: "contract-1",
    ownerId: "u1",
    clientId: "client-acme",
    prestationId: "prest-1",
    billingMode: "manual_invoice",
    status: "active",
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    monthlyPriceEurCents: 5000,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    startedAt: new Date("2026-01-15"),
    canceledAt: null,
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
  },
  {
    id: "contract-2",
    ownerId: "u1",
    clientId: "client-bob",
    prestationId: "prest-1",
    billingMode: "stripe_auto",
    status: "active",
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    monthlyPriceEurCents: 5000,
    currentPeriodStart: new Date("2026-02-01"),
    currentPeriodEnd: new Date("2026-03-01"),
    startedAt: new Date("2026-02-01"),
    canceledAt: null,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
  },
  {
    id: "contract-3",
    ownerId: "u1",
    clientId: "client-globex",
    prestationId: "prest-1",
    billingMode: "manual_invoice",
    status: "canceled",
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    monthlyPriceEurCents: 5000,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    startedAt: new Date("2026-01-10"),
    canceledAt: new Date("2026-03-01"),
    createdAt: new Date("2026-01-10"),
    updatedAt: new Date("2026-03-01"),
  },
];

describe("ContractsTable", () => {
  it("AC12 — renders all contract rows", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    expect(screen.getByText("Acme Studio")).toBeInTheDocument();
    expect(screen.getByText("Bob Indep")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("AC12 — renders mode badges with correct labels", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    expect(screen.getAllByText("Facturation manuelle")).toHaveLength(2);
    expect(screen.getByText("Stripe (auto)")).toBeInTheDocument();
  });

  it("AC12 — renders status badges with correct variants", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    const activeBadges = screen.getAllByText("Actif");
    expect(activeBadges).toHaveLength(2);
    expect(activeBadges[0]).toHaveAttribute("data-variant", "default");

    const canceledBadge = screen.getByText("Annulé");
    expect(canceledBadge).toHaveAttribute("data-variant", "secondary");
  });

  it("AC12 — formats price in EUR", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    const priceCells = screen.getAllByText(/50,00/);
    expect(priceCells.length).toBeGreaterThanOrEqual(1);
  });

  it("AC12 — E5: displays dash when period is null", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("AC12 — E6: cancel button disabled when status is canceled", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    const cancelButton = screen.getByTestId("contract-cancel-contract-3");
    expect(cancelButton).toBeDisabled();
  });

  it("AC12 — cancel button enabled for active contracts", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    const cancelButton = screen.getByTestId("contract-cancel-contract-1");
    expect(cancelButton).not.toBeDisabled();
  });

  it("AC13 — filter selects have correct testids", () => {
    renderWithNuqs(
      <ContractsTable data={mockContracts} clientNames={CLIENT_NAMES} prestationNames={PRESTATION_NAMES} />,
    );
    expect(screen.getByTestId("contracts-filter-status")).toBeInTheDocument();
    expect(screen.getByTestId("contracts-filter-mode")).toBeInTheDocument();
  });
});
