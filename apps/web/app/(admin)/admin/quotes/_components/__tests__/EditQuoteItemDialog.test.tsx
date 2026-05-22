// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditQuoteItemDialog } from "../EditQuoteItemDialog";
import type { QuoteItem } from "@saas/db";
import type { Prestation } from "@saas/db";

const mockAddQuoteItemAction = vi.fn();
const mockUpdateQuoteItemAction = vi.fn();
vi.mock("@/app/actions/quote-items", () => ({
  addQuoteItemAction: (...args: unknown[]) => mockAddQuoteItemAction(...args),
  updateQuoteItemAction: (...args: unknown[]) => mockUpdateQuoteItemAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }, _msg: string) => result.ok),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const QUOTE_ID = "q-1";

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

const fakeItem: QuoteItem = {
  id: "item-1",
  quoteId: QUOTE_ID,
  prestationId: null,
  description: "Ligne existante",
  quantity: 2,
  unitPriceEurCents: 10000,
  sortOrder: 0,
};

describe("EditQuoteItemDialog", () => {
  it("T1 — affiche le bouton submit avec data-testid", () => {
    render(
      <EditQuoteItemDialog
        open={true}
        onOpenChange={vi.fn()}
        quoteId={QUOTE_ID}
        prestations={fakePrestations}
      />,
    );
    expect(screen.getByTestId("quote-item-submit-button")).toBeInTheDocument();
  });

  it("T2 — mode add: appelle addQuoteItemAction à la soumission", async () => {
    mockAddQuoteItemAction.mockResolvedValue({ ok: true, data: fakeItem });
    const onOpenChange = vi.fn();
    render(
      <EditQuoteItemDialog
        open={true}
        onOpenChange={onOpenChange}
        quoteId={QUOTE_ID}
        prestations={fakePrestations}
      />,
    );
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Nouvelle ligne" },
    });
    fireEvent.change(screen.getByLabelText(/quantité/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("quote-item-submit-button"));
    await waitFor(() => expect(mockAddQuoteItemAction).toHaveBeenCalled());
  });

  it("T3 — mode edit: titre 'Modifier la ligne' quand initialData fourni", () => {
    render(
      <EditQuoteItemDialog
        open={true}
        onOpenChange={vi.fn()}
        initialData={fakeItem}
        quoteId={QUOTE_ID}
        prestations={fakePrestations}
      />,
    );
    expect(screen.getByText(/modifier la ligne/i)).toBeInTheDocument();
  });
});
