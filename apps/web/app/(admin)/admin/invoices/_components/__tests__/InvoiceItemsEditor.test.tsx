// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceItemsEditor } from "../InvoiceItemsEditor";
import type { InvoiceItem } from "@saas/db";
import type { Prestation } from "@saas/db";

const mockRemoveInvoiceItemAction = vi.fn();
vi.mock("@/app/actions/invoice-items", () => ({
  removeInvoiceItemAction: (...args: unknown[]) => mockRemoveInvoiceItemAction(...args),
  addInvoiceItemAction: vi.fn(),
  updateInvoiceItemAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

vi.mock("../EditInvoiceItemDialog", () => ({
  EditInvoiceItemDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-dialog">Dialog</div> : null,
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const INVOICE_ID = "inv-1";

const fakeItems: InvoiceItem[] = [
  {
    id: "item-1",
    invoiceId: INVOICE_ID,
    description: "Développement API",
    quantity: 2,
    unitPriceEurCents: 10000,
    sortOrder: 0,
  },
];

const fakePrestations: Prestation[] = [];

describe("InvoiceItemsEditor — canEdit=false", () => {
  it("T1 — affiche le badge Verrouillé", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={false}
      />,
    );
    expect(screen.getByTestId("invoice-items-locked-badge")).toBeInTheDocument();
  });

  it("T2 — pas de bouton Modifier ni Supprimer en mode read-only", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /modifier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /supprimer/i })).not.toBeInTheDocument();
  });

  it("T3 — pas de bouton Ajouter en mode read-only", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /ajouter/i })).not.toBeInTheDocument();
  });
});

describe("InvoiceItemsEditor — canEdit=true", () => {
  it("T4 — items vides affiche 'Aucune ligne'", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={[]}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    expect(screen.getByText("Aucune ligne")).toBeInTheDocument();
  });

  it("T5 — affiche les items dans le tableau avec totaux", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    expect(screen.getByText("Développement API")).toBeInTheDocument();
  });

  it("T6 — clic Modifier ouvre le dialog", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /modifier/i }));
    expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
  });

  it("T7 — clic Supprimer appelle removeInvoiceItemAction", async () => {
    mockRemoveInvoiceItemAction.mockResolvedValue({ ok: true, data: { success: true } });
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));
    await waitFor(() =>
      expect(mockRemoveInvoiceItemAction).toHaveBeenCalledWith("item-1", INVOICE_ID),
    );
  });

  it("T8 — clic Ajouter ouvre le dialog", () => {
    render(
      <InvoiceItemsEditor
        invoiceId={INVOICE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ajouter une ligne/i }));
    expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
  });
});
