// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

(globalThis as Record<string, unknown>).React = React;

const mockListClients = vi.fn();
const mockListPrestations = vi.fn();

vi.mock("@saas/services", () => ({
  listClients: (...args: unknown[]) => mockListClients(...args),
  listPrestations: (...args: unknown[]) => mockListPrestations(...args),
}));

const mockContractFormProps = vi.fn();
vi.mock("../../_components/ContractForm", () => ({
  ContractForm: (props: Record<string, unknown>) => {
    mockContractFormProps(props);
    return <div data-testid="mock-contract-form" />;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderPage() {
  const NewContractPage = (await import("../page")).default;
  return render(await NewContractPage());
}

describe("NewContractPage", () => {
  it("AC1 — passes only recurring prestations to ContractForm", async () => {
    const clients = [{ id: "c-1", name: "Acme" }];
    const prestations = [
      { id: "p-1", name: "Recurring", kind: "recurring", basePriceEurCents: 5000 },
      { id: "p-2", name: "OneShot", kind: "one_shot", basePriceEurCents: 3000 },
    ];
    mockListClients.mockResolvedValue(clients);
    mockListPrestations.mockResolvedValue(prestations);

    await renderPage();

    expect(mockContractFormProps).toHaveBeenCalledWith(
      expect.objectContaining({
        clients,
        prestations: [prestations[0]],
      }),
    );
  });

  it("AC6 — filters out all one_shot prestations", async () => {
    mockListClients.mockResolvedValue([]);
    mockListPrestations.mockResolvedValue([
      { id: "p-1", name: "OneShot Only", kind: "one_shot", basePriceEurCents: 1000 },
    ]);

    await renderPage();

    expect(mockContractFormProps).toHaveBeenCalledWith(
      expect.objectContaining({
        prestations: [],
      }),
    );
  });
});
