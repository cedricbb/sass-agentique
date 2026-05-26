// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

(globalThis as Record<string, unknown>).React = React;

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const mockGetContractById = vi.fn();
const mockListClients = vi.fn();
const mockListPrestations = vi.fn();

vi.mock("@saas/services", () => ({
  maintenanceContractService: {
    getContractById: (...args: unknown[]) => mockGetContractById(...args),
  },
  listClients: (...args: unknown[]) => mockListClients(...args),
  listPrestations: (...args: unknown[]) => mockListPrestations(...args),
}));

vi.mock("../../_components/CancelContractButton", () => ({
  CancelContractButton: (props: { disabled: boolean }) => (
    <button data-testid="contract-cancel-button" disabled={props.disabled}>
      Annuler le contrat
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const MOCK_CONTRACT = {
  id: "ct-1",
  ownerId: "u-1",
  clientId: "c-1",
  prestationId: "p-1",
  billingMode: "manual_invoice",
  status: "active",
  monthlyPriceEurCents: 5000,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  startedAt: new Date("2026-01-15"),
  canceledAt: null,
  stripeSubscriptionId: null,
  stripeCustomerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_CLIENTS = [{ id: "c-1", name: "Acme Corp" }];
const MOCK_PRESTATIONS = [{ id: "p-1", name: "Maintenance Standard", kind: "recurring", basePriceEurCents: 5000 }];

async function renderPage(contractOverride?: Record<string, unknown> | null) {
  const contractValue = contractOverride === null ? null : { ...MOCK_CONTRACT, ...contractOverride };
  mockGetContractById.mockResolvedValue(contractValue);
  mockListClients.mockResolvedValue(MOCK_CLIENTS);
  mockListPrestations.mockResolvedValue(MOCK_PRESTATIONS);

  const ContractDetailPage = (await import("../page")).default;
  return render(await ContractDetailPage({ params: Promise.resolve({ id: "ct-1" }) }));
}

describe("ContractDetailPage", () => {
  it("AC9 — renders all contract fields", async () => {
    await renderPage();

    expect(screen.getByTestId("contract-client-name")).toHaveTextContent("Acme Corp");
    expect(screen.getByTestId("contract-prestation-name")).toHaveTextContent("Maintenance Standard");
    expect(screen.getByTestId("contract-mode")).toBeInTheDocument();
    expect(screen.getByTestId("contract-status")).toBeInTheDocument();
    expect(screen.getByTestId("contract-price")).toBeInTheDocument();
    expect(screen.getByTestId("contract-started-at")).toBeInTheDocument();
  });

  it("AC9 — shows dash for null period", async () => {
    await renderPage({ currentPeriodStart: null, currentPeriodEnd: null });

    expect(screen.getByTestId("contract-period")).toHaveTextContent("—");
  });

  it("AC9b — calls notFound when contract is null", async () => {
    await expect(renderPage(null)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("AC10 — cancel button is disabled when status is canceled", async () => {
    await renderPage({ status: "canceled", canceledAt: new Date("2026-03-01") });

    expect(screen.getByTestId("contract-cancel-button")).toBeDisabled();
  });

  it("AC10 — cancel button is enabled when status is active", async () => {
    await renderPage({ status: "active" });

    expect(screen.getByTestId("contract-cancel-button")).not.toBeDisabled();
  });

  it("E6 — shows canceledAt when contract is canceled", async () => {
    await renderPage({ status: "canceled", canceledAt: new Date("2026-03-01") });

    expect(screen.getByTestId("contract-canceled-at")).toBeInTheDocument();
  });
});
