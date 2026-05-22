// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditInvoiceItemDialog } from "../EditInvoiceItemDialog";
import type { InvoiceItem } from "@saas/db";
import type { Prestation } from "@saas/db";

const mockAddInvoiceItemAction = vi.fn();
const mockUpdateInvoiceItemAction = vi.fn();
vi.mock("@/app/actions/invoice-items", () => ({
  addInvoiceItemAction: (...args: unknown[]) => mockAddInvoiceItemAction(...args),
  updateInvoiceItemAction: (...args: unknown[]) => mockUpdateInvoiceItemAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }, _msg: string) => result.ok),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const INVOICE_ID = "inv-1";

const fakePrestations: Prestation[] = [
  {
    id: "p-1",
    name: "Dev frontend",
    slug: "dev-frontend",
    description: null,
    basePriceEurCents: 75000,
    kind: "one_shot",
    stripeProductId: null,
    stripePriceId: null,
    isActive: true,
    sortOrder: 0,
    ownerId: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const fakeItem: InvoiceItem = {
  id: "item-1",
  invoiceId: INVOICE_ID,
  description: "Ligne existante",
  quantity: 2,
  unitPriceEurCents: 10000,
  sortOrder: 0,
};

describe("EditInvoiceItemDialog", () => {
  it("T1 — affiche le bouton submit avec data-testid", () => {
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    expect(screen.getByTestId("invoice-item-submit-button")).toBeInTheDocument();
  });

  it("T2 — mode add: appelle addInvoiceItemAction à la soumission", async () => {
    mockAddInvoiceItemAction.mockResolvedValue({ ok: true, data: fakeItem });
    const onOpenChange = vi.fn();
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={onOpenChange}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Nouvelle ligne" },
    });
    fireEvent.change(screen.getByLabelText(/quantité/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("invoice-item-submit-button"));
    await waitFor(() => expect(mockAddInvoiceItemAction).toHaveBeenCalled());
  });

  it("T3 — mode add: payload SANS prestationId", async () => {
    mockAddInvoiceItemAction.mockResolvedValue({ ok: true, data: fakeItem });
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Ligne test" },
    });
    fireEvent.change(screen.getByLabelText(/quantité/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("invoice-item-submit-button"));
    await waitFor(() => {
      const payload = mockAddInvoiceItemAction.mock.calls[0][1];
      expect(payload).not.toHaveProperty("prestationId");
    });
  });

  it("T4 — mode edit: appelle updateInvoiceItemAction", async () => {
    mockUpdateInvoiceItemAction.mockResolvedValue({ ok: true, data: fakeItem });
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        initialData={fakeItem}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.click(screen.getByTestId("invoice-item-submit-button"));
    await waitFor(() =>
      expect(mockUpdateInvoiceItemAction).toHaveBeenCalledWith("item-1", expect.any(Object)),
    );
  });

  it("T5 — mode edit: payload SANS prestationId", async () => {
    mockUpdateInvoiceItemAction.mockResolvedValue({ ok: true, data: fakeItem });
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        initialData={fakeItem}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.click(screen.getByTestId("invoice-item-submit-button"));
    await waitFor(() => {
      const payload = mockUpdateInvoiceItemAction.mock.calls[0][1];
      expect(payload).not.toHaveProperty("prestationId");
    });
  });

  it("T6 — mode edit: champs pré-remplis", () => {
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        initialData={fakeItem}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    expect(screen.getByText(/modifier la ligne/i)).toBeInTheDocument();
  });

  it("T7 — toggle Prestation affiche le Select", () => {
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /prestation/i }));
    expect(screen.getByText("Sélectionner une prestation")).toBeInTheDocument();
  });

  it("T8 — toggle Prestation affiche les options de prestation", () => {
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /prestation/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("T9 — validation rejetée description vide", async () => {
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("invoice-item-submit-button"));
    await waitFor(() => {
      expect(screen.getByText(/String must contain at least 1/i)).toBeInTheDocument();
    });
  });

  it("T10 — prix unitaire a un step 0.01 pour la saisie en euros", () => {
    render(
      <EditInvoiceItemDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId={INVOICE_ID}
        prestations={fakePrestations}
      />,
    );
    const priceInput = screen.getByLabelText(/prix unitaire/i);
    expect(priceInput).toHaveAttribute("step", "0.01");
    expect(priceInput).toHaveAttribute("type", "number");
  });
});
