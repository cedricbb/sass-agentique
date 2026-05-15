import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  addQuoteItem: vi.fn(),
  updateQuoteItem: vi.fn(),
  removeQuoteItem: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  addQuoteItemAction,
  updateQuoteItemAction,
  removeQuoteItemAction,
} from "../quote-items";
import { addQuoteItem, updateQuoteItem, removeQuoteItem } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedAddQuoteItem = vi.mocked(addQuoteItem);
const mockedUpdateQuoteItem = vi.mocked(updateQuoteItem);
const mockedRemoveQuoteItem = vi.mocked(removeQuoteItem);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const QUOTE_ID = "550e8400-e29b-41d4-a716-446655440000";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440000";
const _PRESTATION_ID = "770e8400-e29b-41d4-a716-446655440000";

const fakeAdmin = { id: "admin-1", role: "admin" };

const fakeItem = {
  id: ITEM_ID,
  quoteId: QUOTE_ID,
  prestationId: null,
  description: "Prestation test",
  quantity: 2,
  unitPriceEurCents: 5000,
  sortOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin as never);
});

describe("addQuoteItemAction", () => {
  it("T1 — retourne l'item créé et revalidate le path", async () => {
    mockedAddQuoteItem.mockResolvedValue(fakeItem as never);
    const result = await addQuoteItemAction(QUOTE_ID, {
      description: "Prestation test",
      quantity: 2,
      unitPriceEurCents: 5000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(fakeItem);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}`);
  });

  it("T2 — VALIDATION_ERROR si quantity=0", async () => {
    const result = await addQuoteItemAction(QUOTE_ID, {
      description: "Test",
      quantity: 0,
      unitPriceEurCents: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(mockedAddQuoteItem).not.toHaveBeenCalled();
  });

  it("T3 — VALIDATION_ERROR si description vide", async () => {
    const result = await addQuoteItemAction(QUOTE_ID, {
      description: "",
      quantity: 1,
      unitPriceEurCents: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("updateQuoteItemAction", () => {
  it("T4 — retourne l'item mis à jour et revalidate le bon quoteId", async () => {
    mockedUpdateQuoteItem.mockResolvedValue(fakeItem as never);
    const result = await updateQuoteItemAction(ITEM_ID, { quantity: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.quantity).toBe(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}`);
  });

  it("T5 — INTERNAL_ERROR si updateQuoteItem retourne null", async () => {
    mockedUpdateQuoteItem.mockResolvedValue(null as never);
    const result = await updateQuoteItemAction(ITEM_ID, { quantity: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("removeQuoteItemAction", () => {
  it("T6 — supprime l'item et revalidate le path", async () => {
    mockedRemoveQuoteItem.mockResolvedValue(undefined as never);
    const result = await removeQuoteItemAction(ITEM_ID, QUOTE_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ success: true });
    expect(mockedRemoveQuoteItem).toHaveBeenCalledWith(ITEM_ID);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}`);
  });
});
