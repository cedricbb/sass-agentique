// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContractForm } from "../ContractForm";

Element.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateContractAction = vi.fn();
vi.mock("@/app/actions/contracts", () => ({
  createContractAction: (input: unknown) => mockCreateContractAction(input),
}));

const mockToastResult = vi.fn((_result: unknown, _msg?: unknown) => (_result as { ok: boolean }).ok);
vi.mock("@/lib/toast", () => ({
  toastResult: (result: unknown, msg: unknown) => mockToastResult(result, msg),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const CLIENT_ID = "00000000-0000-4000-a000-000000000001";
const PRESTATION_ID_1 = "00000000-0000-4000-a000-000000000010";
const PRESTATION_ID_2 = "00000000-0000-4000-a000-000000000020";

const MOCK_CLIENTS = [
  {
    id: CLIENT_ID,
    name: "Acme Corp",
    slug: "acme",
    type: "company",
    email: null,
    phone: null,
    billingAddress: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const MOCK_PRESTATIONS = [
  {
    id: PRESTATION_ID_1,
    name: "Maintenance Standard",
    slug: "maintenance-standard",
    kind: "recurring",
    basePriceEurCents: 5000,
    description: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: PRESTATION_ID_2,
    name: "Maintenance Premium",
    slug: "maintenance-premium",
    kind: "recurring",
    basePriceEurCents: 10000,
    description: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function renderForm(prestations = MOCK_PRESTATIONS) {
  return render(<ContractForm clients={MOCK_CLIENTS} prestations={prestations} />);
}

async function selectOption(testId: string, optionName: string) {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(screen.getByRole("option", { name: optionName })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

describe("ContractForm", () => {
  it("AC2 — renders all 5 form fields", () => {
    renderForm();

    expect(screen.getByTestId("contract-client-select")).toBeInTheDocument();
    expect(screen.getByTestId("contract-prestation-select")).toBeInTheDocument();
    expect(screen.getByTestId("contract-billing-mode-select")).toBeInTheDocument();
    expect(screen.getByTestId("contract-monthly-price-input")).toBeInTheDocument();
    expect(screen.getByTestId("contract-started-at-input")).toBeInTheDocument();
    expect(screen.getByTestId("contract-submit")).toBeInTheDocument();
  });

  it("E1 — shows message when no recurring prestations available", () => {
    renderForm([]);

    expect(screen.getByTestId("no-recurring-message")).toHaveTextContent("Aucune prestation récurrente disponible");
    expect(screen.getByTestId("contract-submit")).toBeDisabled();
  });

  it("AC4 — price input is not readOnly by default (manual_invoice)", () => {
    renderForm();

    const priceInput = screen.getByTestId("contract-monthly-price-input");
    expect(priceInput).not.toHaveAttribute("readonly");
    expect(screen.queryByTestId("stripe-auto-hint")).not.toBeInTheDocument();
  });

  it("AC4 — price input is readOnly when billingMode is stripe_auto", async () => {
    renderForm();

    await selectOption("contract-billing-mode-select", "Stripe (auto)");

    await waitFor(() => {
      expect(screen.getByTestId("contract-monthly-price-input")).toHaveAttribute("readonly");
      expect(screen.getByTestId("stripe-auto-hint")).toHaveTextContent("Piloté par Stripe");
    });
  });

  it("AC3 — pre-fills price when prestation is selected", async () => {
    renderForm();

    await selectOption("contract-prestation-select", "Maintenance Standard");

    await waitFor(() => {
      const priceInput = screen.getByTestId("contract-monthly-price-input") as HTMLInputElement;
      expect(priceInput.value).toBe("5000");
    });
  });

  it("AC7 — redirects on successful submit", async () => {
    mockCreateContractAction.mockResolvedValue({ ok: true, data: { id: "ct-1" } });
    renderForm();

    await selectOption("contract-client-select", "Acme Corp");
    await selectOption("contract-prestation-select", "Maintenance Standard");

    const startedAtInput = screen.getByTestId("contract-started-at-input");
    fireEvent.change(startedAtInput, { target: { value: "2026-01-01" } });

    fireEvent.click(screen.getByTestId("contract-submit"));

    await waitFor(() => {
      expect(mockCreateContractAction).toHaveBeenCalled();
      expect(mockToastResult).toHaveBeenCalledWith({ ok: true, data: { id: "ct-1" } }, "Contrat créé");
      expect(mockPush).toHaveBeenCalledWith("/admin/contracts");
    });
  });

  it("AC8 — does not redirect on duplicate error", async () => {
    mockCreateContractAction.mockResolvedValue({
      ok: false,
      error: { code: "CONTRACT_DUPLICATE", message: "Ce client a déjà un contrat" },
    });
    renderForm();

    await selectOption("contract-client-select", "Acme Corp");
    await selectOption("contract-prestation-select", "Maintenance Standard");

    const startedAtInput = screen.getByTestId("contract-started-at-input");
    fireEvent.change(startedAtInput, { target: { value: "2026-01-01" } });

    fireEvent.click(screen.getByTestId("contract-submit"));

    await waitFor(() => {
      expect(mockCreateContractAction).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
