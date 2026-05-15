// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuoteItemsEditor } from "../QuoteItemsEditor";
import type { QuoteItem } from "@saas/db";
import type { Prestation } from "@saas/db";

const mockRemoveQuoteItemAction = vi.fn();
vi.mock("@/app/actions/quote-items", () => ({
  removeQuoteItemAction: (...args: unknown[]) => mockRemoveQuoteItemAction(...args),
  addQuoteItemAction: vi.fn(),
  updateQuoteItemAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

vi.mock("../EditQuoteItemDialog", () => ({
  EditQuoteItemDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-dialog">Dialog</div> : null,
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const QUOTE_ID = "q-1";

const fakeItems: QuoteItem[] = [
  {
    id: "item-1",
    quoteId: QUOTE_ID,
    prestationId: null,
    description: "Développement frontend",
    quantity: 3,
    unitPriceEurCents: 50000,
    sortOrder: 0,
  },
];

const fakePrestations: Prestation[] = [];

describe("QuoteItemsEditor — canEdit=false", () => {
  it("T1 — affiche le badge Verrouillé", () => {
    render(
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={false}
      />,
    );
    expect(screen.getByTestId("quote-items-locked-badge")).toBeInTheDocument();
  });

  it("T2 — pas de bouton Modifier ni Supprimer en mode read-only", () => {
    render(
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
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
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /ajouter/i })).not.toBeInTheDocument();
  });
});

describe("QuoteItemsEditor — canEdit=true", () => {
  it("T4 — pas de badge Verrouillé quand canEdit=true", () => {
    render(
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    expect(screen.queryByTestId("quote-items-locked-badge")).not.toBeInTheDocument();
  });

  it("T5 — affiche les items dans le tableau", () => {
    render(
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    expect(screen.getByText("Développement frontend")).toBeInTheDocument();
  });

  it("T6 — clic Supprimer appelle removeQuoteItemAction", async () => {
    mockRemoveQuoteItemAction.mockResolvedValue({ ok: true, data: { success: true } });
    render(
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));
    await waitFor(() =>
      expect(mockRemoveQuoteItemAction).toHaveBeenCalledWith("item-1", QUOTE_ID)
    );
  });

  it("T7 — clic Ajouter ouvre le dialog", () => {
    render(
      <QuoteItemsEditor
        quoteId={QUOTE_ID}
        items={fakeItems}
        prestations={fakePrestations}
        canEdit={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ajouter une ligne/i }));
    expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
  });
});
