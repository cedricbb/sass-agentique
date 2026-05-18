import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  addInvoiceItem: vi.fn(),
  updateInvoiceItem: vi.fn(),
  removeInvoiceItem: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  addInvoiceItemAction,
  updateInvoiceItemAction,
  removeInvoiceItemAction,
} from "../invoice-items";
import { addInvoiceItem, updateInvoiceItem, removeInvoiceItem } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedAddInvoiceItem = vi.mocked(addInvoiceItem);
const mockedUpdateInvoiceItem = vi.mocked(updateInvoiceItem);
const mockedRemoveInvoiceItem = vi.mocked(removeInvoiceItem);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const INVOICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440000";

const fakeAdmin = { id: "admin-1", role: "admin" };

const fakeItem = {
  id: ITEM_ID,
  invoiceId: INVOICE_ID,
  description: "Développement API",
  quantity: 2,
  unitPriceEurCents: 10000,
  sortOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin as never);
});

describe("addInvoiceItemAction", () => {
  it("T1 — retourne l'item créé et revalidate le path", async () => {
    mockedAddInvoiceItem.mockResolvedValue(fakeItem as never);
    const result = await addInvoiceItemAction(INVOICE_ID, {
      description: "Développement API",
      quantity: 2,
      unitPriceEurCents: 10000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(fakeItem);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/invoices/${INVOICE_ID}`);
  });

  it("T2 — VALIDATION_ERROR si description vide", async () => {
    const result = await addInvoiceItemAction(INVOICE_ID, {
      description: "",
      quantity: 1,
      unitPriceEurCents: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(mockedAddInvoiceItem).not.toHaveBeenCalled();
  });

  it("T3 — UNAUTHORIZED si non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("UNAUTHORIZED"));
    const result = await addInvoiceItemAction(INVOICE_ID, {
      description: "Test",
      quantity: 1,
      unitPriceEurCents: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("updateInvoiceItemAction", () => {
  it("T4 — retourne l'item mis à jour et revalidate le bon invoiceId", async () => {
    mockedUpdateInvoiceItem.mockResolvedValue(fakeItem as never);
    const result = await updateInvoiceItemAction(ITEM_ID, { quantity: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(fakeItem);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/invoices/${INVOICE_ID}`);
  });

  it("T5 — VALIDATION_ERROR si quantity=0", async () => {
    const result = await updateInvoiceItemAction(ITEM_ID, { quantity: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("T6 — UNAUTHORIZED si non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("UNAUTHORIZED"));
    const result = await updateInvoiceItemAction(ITEM_ID, { quantity: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("T7 — INTERNAL_ERROR si item not found", async () => {
    mockedUpdateInvoiceItem.mockResolvedValue(null as never);
    const result = await updateInvoiceItemAction(ITEM_ID, { quantity: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("removeInvoiceItemAction", () => {
  it("T8 — supprime l'item et retourne success", async () => {
    mockedRemoveInvoiceItem.mockResolvedValue(undefined as never);
    const result = await removeInvoiceItemAction(ITEM_ID, INVOICE_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ success: true });
    expect(mockedRemoveInvoiceItem).toHaveBeenCalledWith(ITEM_ID);
  });

  it("T9 — UNAUTHORIZED si non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("UNAUTHORIZED"));
    const result = await removeInvoiceItemAction(ITEM_ID, INVOICE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("T10 — revalidatePath appelé avec le bon invoiceId", async () => {
    mockedRemoveInvoiceItem.mockResolvedValue(undefined as never);
    await removeInvoiceItemAction(ITEM_ID, INVOICE_ID);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/invoices/${INVOICE_ID}`);
  });
});
