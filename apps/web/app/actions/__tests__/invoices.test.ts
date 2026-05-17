import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => {
  const InvalidInvoiceTransitionError = class extends Error {
    constructor(from: string, to: string) {
      super(`Invalid transition from "${from}" to "${to}"`);
      this.name = "InvalidInvoiceTransitionError";
    }
  };
  Object.defineProperty(InvalidInvoiceTransitionError, "name", {
    value: "InvalidInvoiceTransitionError",
  });
  const InvalidQuoteForInvoicingError = class extends Error {
    constructor(quoteId: string, status: string) {
      super(`Quote "${quoteId}" has status "${status}", expected "accepted"`);
      this.name = "InvalidQuoteForInvoicingError";
    }
  };
  Object.defineProperty(InvalidQuoteForInvoicingError, "name", {
    value: "InvalidQuoteForInvoicingError",
  });
  const QuoteAlreadyInvoicedError = class extends Error {
    constructor(quoteId: string) {
      super(`Quote "${quoteId}" is already invoiced`);
      this.name = "QuoteAlreadyInvoicedError";
    }
  };
  Object.defineProperty(QuoteAlreadyInvoicedError, "name", {
    value: "QuoteAlreadyInvoicedError",
  });
  return {
    createInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    transitionInvoiceStatus: vi.fn(),
    getInvoiceById: vi.fn(),
    listInvoices: vi.fn(),
    createInvoiceFromQuote: vi.fn(),
    InvalidInvoiceTransitionError,
    InvalidQuoteForInvoicingError,
    QuoteAlreadyInvoicedError,
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createInvoiceAction,
  updateInvoiceAction,
  transitionInvoiceStatusAction,
  getInvoiceByIdAction,
  listInvoicesAction,
  createInvoiceFromQuoteAction,
} from "../invoices";
import {
  createInvoice,
  updateInvoice,
  transitionInvoiceStatus,
  getInvoiceById,
  listInvoices,
  createInvoiceFromQuote,
  InvalidInvoiceTransitionError,
  InvalidQuoteForInvoicingError,
  QuoteAlreadyInvoicedError,
} from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateInvoice = vi.mocked(createInvoice);
const mockedUpdateInvoice = vi.mocked(updateInvoice);
const mockedTransitionInvoiceStatus = vi.mocked(transitionInvoiceStatus);
const mockedGetInvoiceById = vi.mocked(getInvoiceById);
const mockedListInvoices = vi.mocked(listInvoices);
const mockedCreateInvoiceFromQuote = vi.mocked(createInvoiceFromQuote);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "660e8400-e29b-41d4-a716-446655440000";
const QUOTE_UUID = "770e8400-e29b-41d4-a716-446655440000";

const fakeAdmin = {
  id: "admin-1",
  email: "admin@test.com",
  role: "admin",
  name: "Admin",
} as unknown as Awaited<ReturnType<typeof requireAdmin>>;

const mockInvoice = {
  id: "inv-1",
  clientId: VALID_UUID,
  projectId: null,
  quoteId: null,
  number: "INV-2026-001",
  status: "draft",
  dueAt: null,
  vatRateBps: 2000,
  totalEurCents: 0,
  paidAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRedirectError() {
  const err = new Error("NEXT_REDIRECT");
  (err as unknown as { digest: string }).digest = "NEXT_REDIRECT;/login";
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin);
});

describe("createInvoiceAction", () => {
  const validInput = { clientId: VALID_UUID };

  it("T1 — happy path", async () => {
    mockedCreateInvoice.mockResolvedValue(mockInvoice as never);
    const result = await createInvoiceAction(validInput);
    expect(result).toEqual({ ok: true, data: mockInvoice });
    expect(mockedCreateInvoice).toHaveBeenCalledWith({ clientId: VALID_UUID });
  });

  it("T2 — zod fail clientId not UUID", async () => {
    const result = await createInvoiceAction({ clientId: "not-a-uuid" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T3 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createInvoiceAction(validInput)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T4 — revalidatePath called", async () => {
    mockedCreateInvoice.mockResolvedValue(mockInvoice as never);
    await createInvoiceAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices");
  });

  it("T5 — optional fields passed through", async () => {
    const input = {
      clientId: VALID_UUID,
      projectId: OTHER_UUID,
      quoteId: QUOTE_UUID,
      dueAt: "2026-12-31" as unknown as Date,
      vatRateBps: 2000,
      notes: "Test notes",
    };
    mockedCreateInvoice.mockResolvedValue(mockInvoice as never);
    await createInvoiceAction(input);
    expect(mockedCreateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: VALID_UUID,
        projectId: OTHER_UUID,
        quoteId: QUOTE_UUID,
        vatRateBps: 2000,
        notes: "Test notes",
      }),
    );
  });

  it("T6 — no number field sent to service", async () => {
    mockedCreateInvoice.mockResolvedValue(mockInvoice as never);
    await createInvoiceAction({ clientId: VALID_UUID, number: "INV-HACK" } as never);
    const call = mockedCreateInvoice.mock.calls[0][0];
    expect(call).not.toHaveProperty("number");
  });
});

describe("updateInvoiceAction", () => {
  it("T7 — happy path", async () => {
    mockedUpdateInvoice.mockResolvedValue(mockInvoice as never);
    const result = await updateInvoiceAction("inv-1", { notes: "updated" });
    expect(result).toEqual({ ok: true, data: mockInvoice });
    expect(mockedUpdateInvoice).toHaveBeenCalledWith("inv-1", { notes: "updated" });
  });

  it("T8 — zod fail vatRateBps > 10000", async () => {
    const result = await updateInvoiceAction("inv-1", { vatRateBps: 10001 });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T9 — null → INTERNAL_ERROR", async () => {
    mockedUpdateInvoice.mockResolvedValue(null as never);
    const result = await updateInvoiceAction("inv-1", { notes: "x" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("T10 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(updateInvoiceAction("inv-1", { notes: "x" })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T11 — revalidatePath ×2", async () => {
    mockedUpdateInvoice.mockResolvedValue(mockInvoice as never);
    await updateInvoiceAction("inv-1", { notes: "x" });
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices/inv-1");
  });

  it("T12 — projectId null dissociation", async () => {
    mockedUpdateInvoice.mockResolvedValue(mockInvoice as never);
    await updateInvoiceAction("inv-1", { projectId: null });
    expect(mockedUpdateInvoice).toHaveBeenCalledWith("inv-1", { projectId: null });
  });

  it("T13 — empty patch", async () => {
    mockedUpdateInvoice.mockResolvedValue(mockInvoice as never);
    const result = await updateInvoiceAction("inv-1", {});
    expect(result).toEqual({ ok: true, data: mockInvoice });
  });
});

describe("transitionInvoiceStatusAction", () => {
  it("T14 — happy path draft→sent", async () => {
    const sent = { ...mockInvoice, status: "sent" };
    mockedTransitionInvoiceStatus.mockResolvedValue(sent as never);
    const result = await transitionInvoiceStatusAction("inv-1", { targetStatus: "sent" });
    expect(result).toMatchObject({ ok: true, data: sent });
    expect(mockedTransitionInvoiceStatus).toHaveBeenCalledWith("inv-1", "sent");
  });

  it("T15 — InvalidInvoiceTransitionError → 409", async () => {
    mockedTransitionInvoiceStatus.mockRejectedValue(
      new InvalidInvoiceTransitionError("draft", "paid"),
    );
    const result = await transitionInvoiceStatusAction("inv-1", { targetStatus: "paid" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVOICE_INVALID_TRANSITION" },
    });
  });

  it("T16 — null → INTERNAL_ERROR", async () => {
    mockedTransitionInvoiceStatus.mockResolvedValue(null as never);
    const result = await transitionInvoiceStatusAction("inv-1", { targetStatus: "sent" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("T17 — zod fail bogus status", async () => {
    const result = await transitionInvoiceStatusAction("inv-1", { targetStatus: "bogus" as never });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T18 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(
      transitionInvoiceStatusAction("inv-1", { targetStatus: "sent" }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T19 — revalidatePath ×2", async () => {
    mockedTransitionInvoiceStatus.mockResolvedValue({ ...mockInvoice, status: "sent" } as never);
    await transitionInvoiceStatusAction("inv-1", { targetStatus: "sent" });
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices/inv-1");
  });

  it("T20 — 5 statuses accepted by schema", async () => {
    const { transitionInvoiceStatusSchema } = await import("@/lib/schemas/invoice.schemas");
    for (const s of ["draft", "sent", "paid", "overdue", "cancelled"]) {
      const result = transitionInvoiceStatusSchema.safeParse({ targetStatus: s });
      expect(result.success).toBe(true);
    }
  });
});

describe("createInvoiceFromQuoteAction", () => {
  it("T21 — happy path", async () => {
    mockedCreateInvoiceFromQuote.mockResolvedValue(mockInvoice as never);
    const result = await createInvoiceFromQuoteAction({ quoteId: QUOTE_UUID });
    expect(result).toEqual({ ok: true, data: mockInvoice });
    expect(mockedCreateInvoiceFromQuote).toHaveBeenCalledWith(QUOTE_UUID);
  });

  it("T22 — zod fail quoteId not UUID", async () => {
    const result = await createInvoiceFromQuoteAction({ quoteId: "not-uuid" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T23 — InvalidQuoteForInvoicingError → 409", async () => {
    mockedCreateInvoiceFromQuote.mockRejectedValue(
      new InvalidQuoteForInvoicingError(QUOTE_UUID, "draft"),
    );
    const result = await createInvoiceFromQuoteAction({ quoteId: QUOTE_UUID });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "QUOTE_NOT_INVOICABLE" },
    });
  });

  it("T24 — QuoteAlreadyInvoicedError → 409", async () => {
    mockedCreateInvoiceFromQuote.mockRejectedValue(
      new QuoteAlreadyInvoicedError(QUOTE_UUID),
    );
    const result = await createInvoiceFromQuoteAction({ quoteId: QUOTE_UUID });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "QUOTE_ALREADY_INVOICED" },
    });
  });

  it("T25 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createInvoiceFromQuoteAction({ quoteId: QUOTE_UUID })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T26 — revalidatePath invoices + quote", async () => {
    mockedCreateInvoiceFromQuote.mockResolvedValue(mockInvoice as never);
    await createInvoiceFromQuoteAction({ quoteId: QUOTE_UUID });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_UUID}`);
  });
});

describe("getInvoiceByIdAction", () => {
  it("T27 — found", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    const result = await getInvoiceByIdAction("inv-1");
    expect(result).toEqual({ ok: true, data: mockInvoice });
  });

  it("T28 — not found (null)", async () => {
    mockedGetInvoiceById.mockResolvedValue(null);
    const result = await getInvoiceByIdAction("inv-999");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("T29 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(getInvoiceByIdAction("inv-1")).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T30 — no revalidatePath", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    await getInvoiceByIdAction("inv-1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("listInvoicesAction", () => {
  it("T31 — sans opts", async () => {
    mockedListInvoices.mockResolvedValue([mockInvoice] as never);
    const result = await listInvoicesAction();
    expect(result).toEqual({ ok: true, data: [mockInvoice] });
    expect(mockedListInvoices).toHaveBeenCalledWith(undefined);
  });

  it("T32 — clientId filter", async () => {
    mockedListInvoices.mockResolvedValue([mockInvoice] as never);
    await listInvoicesAction({ clientId: VALID_UUID });
    expect(mockedListInvoices).toHaveBeenCalledWith({ clientId: VALID_UUID });
  });

  it("T33 — status single", async () => {
    mockedListInvoices.mockResolvedValue([] as never);
    await listInvoicesAction({ status: "draft" });
    expect(mockedListInvoices).toHaveBeenCalledWith({ status: "draft" });
  });

  it("T34 — status array", async () => {
    mockedListInvoices.mockResolvedValue([] as never);
    await listInvoicesAction({ status: ["draft", "sent"] });
    expect(mockedListInvoices).toHaveBeenCalledWith({ status: ["draft", "sent"] });
  });

  it("T35 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(listInvoicesAction()).rejects.toThrow("NEXT_REDIRECT");
  });
});
