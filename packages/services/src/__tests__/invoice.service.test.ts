import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "orderBy",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.transaction = vi.fn(async (fn: (tx: typeof chain) => unknown) => fn(chain));
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  invoices: { id: "id", ownerId: "ownerId", clientId: "clientId", number: "number", status: "status", totalEurCents: "totalEurCents", quoteId: "quoteId" },
  invoiceItems: { id: "id", invoiceId: "invoiceId", unitPriceEurCents: "unitPriceEurCents", quantity: "quantity" },
  invoiceStatusEnum: { enumValues: ["draft", "sent", "paid", "overdue", "cancelled"] },
  quotes: { id: "id", ownerId: "ownerId", clientId: "clientId", number: "number", status: "status" },
  quoteItems: { id: "id", quoteId: "quoteId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
  desc: vi.fn((...args: unknown[]) => ({ op: "desc", args })),
  asc: vi.fn((...args: unknown[]) => ({ op: "asc", args })),
  like: vi.fn((...args: unknown[]) => ({ op: "like", args })),
  sql: vi.fn((...args: unknown[]) => ({ op: "sql", args })),
  count: vi.fn(() => "count"),
}));

import {
  VALID_INVOICE_TRANSITIONS,
  canTransitionInvoice,
  computeInvoiceTtc,
  CUSTOMER_VISIBLE_INVOICE_STATUSES,
  InvalidInvoiceTransitionError,
  InvalidQuoteForInvoicingError,
  QuoteAlreadyInvoicedError,
  generateInvoiceNumber,
  listInvoices,
  listInvoicesByClient,
  getInvoiceById,
  getInvoiceByNumber,
  createInvoice,
  updateInvoice,
  getInvoiceByIdForOwner,
  transitionInvoiceStatus,
  deleteInvoice,
  createInvoiceFromQuote,
  listInvoiceItems,
  addInvoiceItem,
  updateInvoiceItem,
  removeInvoiceItem,
  recomputeInvoiceTotal,
  countUnpaidInvoicesForClient,
} from "../invoice.service";

const OWNER_ID = "a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4";

const INV_ID = "11111111-1111-1111-1111-111111111111";

const INV_FIXTURE = {
  id: INV_ID,
  ownerId: OWNER_ID,
  clientId: "c1",
  quoteId: null,
  projectId: null,
  number: "INV-2026-001",
  status: "draft",
  issuedAt: null,
  dueAt: null,
  paidAt: null,
  totalEurCents: 10000,
  vatRateBps: 2000,
  stripePaymentIntentId: null,
  stripeCheckoutSessionId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  dbMock = makeDrizzleMock();
  vi.clearAllMocks();
});

describe("VALID_INVOICE_TRANSITIONS", () => {
  it("has 5 keys matching the state machine", () => {
    expect(Object.keys(VALID_INVOICE_TRANSITIONS).sort()).toEqual([
      "cancelled", "draft", "overdue", "paid", "sent",
    ]);
  });

  it("draft can go to sent or cancelled", () => {
    expect(VALID_INVOICE_TRANSITIONS.draft).toEqual(["sent", "cancelled"]);
  });

  it("sent can go to paid, overdue, or cancelled", () => {
    expect(VALID_INVOICE_TRANSITIONS.sent).toEqual(["paid", "overdue", "cancelled"]);
  });

  it("overdue can go to paid or cancelled", () => {
    expect(VALID_INVOICE_TRANSITIONS.overdue).toEqual(["paid", "cancelled"]);
  });

  it("paid is terminal", () => {
    expect(VALID_INVOICE_TRANSITIONS.paid).toEqual([]);
  });

  it("cancelled is terminal", () => {
    expect(VALID_INVOICE_TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("canTransitionInvoice", () => {
  it("returns true for valid transition", () => {
    expect(canTransitionInvoice("draft", "sent")).toBe(true);
  });

  it("returns false for invalid transition", () => {
    expect(canTransitionInvoice("draft", "paid")).toBe(false);
  });
});

describe("computeInvoiceTtc", () => {
  it("computes amounts correctly", () => {
    const result = computeInvoiceTtc({ totalEurCents: 10000, vatRateBps: 2000 });
    expect(result).toEqual({ totalHtCents: 10000, vatCents: 2000, totalTtcCents: 12000 });
  });

  it("rounds vatCents", () => {
    const result = computeInvoiceTtc({ totalEurCents: 333, vatRateBps: 2000 });
    expect(result.vatCents).toBe(Math.round(333 * 2000 / 10000));
  });
});

describe("Error classes", () => {
  it("InvalidInvoiceTransitionError", () => {
    const err = new InvalidInvoiceTransitionError("draft", "paid");
    expect(err.name).toBe("InvalidInvoiceTransitionError");
    expect(err.message).toContain("draft");
  });

  it("InvalidQuoteForInvoicingError", () => {
    const err = new InvalidQuoteForInvoicingError("q1", "draft");
    expect(err.name).toBe("InvalidQuoteForInvoicingError");
    expect(err.message).toContain("q1");
  });

  it("QuoteAlreadyInvoicedError", () => {
    const err = new QuoteAlreadyInvoicedError("q1");
    expect(err.name).toBe("QuoteAlreadyInvoicedError");
    expect(err.message).toContain("q1");
  });
});

describe("generateInvoiceNumber", () => {
  it("returns INV-YYYY-001 when no existing invoice", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    const result = await generateInvoiceNumber(OWNER_ID, 2026);
    expect(result).toBe("INV-2026-001");
  });

  it("increments last number", async () => {
    dbMock.limit!.mockResolvedValueOnce([{ number: "INV-2026-007" }]);
    const result = await generateInvoiceNumber(OWNER_ID, 2026);
    expect(result).toBe("INV-2026-008");
  });

  it("throws on NaN parse", async () => {
    dbMock.limit!.mockResolvedValueOnce([{ number: "INV-2026-ABC" }]);
    await expect(generateInvoiceNumber(OWNER_ID, 2026)).rejects.toThrow("Cannot parse last invoice number");
  });

  it("throws on invalid ownerId", async () => {
    await expect(generateInvoiceNumber("not-a-uuid", 2026)).rejects.toThrow("Invalid ownerId");
  });
});

describe("listInvoices", () => {
  it("returns all invoices when no opts", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await listInvoices();
    expect(result).toEqual([INV_FIXTURE]);
    expect(dbMock.orderBy).toHaveBeenCalled();
  });

  it("filters by clientId", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([INV_FIXTURE]);
    await listInvoices({ clientId: "c1" });
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
  });

  it("filters by status array via inArray", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([]);
    await listInvoices({ status: ["draft", "sent"] });
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
  });
});

describe("listInvoices ownerId scope", () => {
  it("listInvoices filtre par ownerId via eq", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([INV_FIXTURE]);
    await listInvoices({ ownerId: OWNER_ID });
    expect(eq).toHaveBeenCalledWith("ownerId", OWNER_ID);
    expect(dbMock.where).toHaveBeenCalled();
  });
});

describe("getInvoiceByIdForOwner", () => {
  it("getInvoiceByIdForOwner retourne l'invoice quand id et owner correspondent", async () => {
    dbMock.limit!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await getInvoiceByIdForOwner(INV_ID, OWNER_ID);
    expect(result).toEqual(INV_FIXTURE);
    expect(eq).toHaveBeenCalledWith("ownerId", OWNER_ID);
  });

  it("getInvoiceByIdForOwner retourne null quand owner different", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    const result = await getInvoiceByIdForOwner(INV_ID, "b0b0b0b0-c1c1-d2d2-e3e3-f4f4f4f4f4f4");
    expect(result).toBeNull();
    expect(eq).toHaveBeenCalledWith("ownerId", "b0b0b0b0-c1c1-d2d2-e3e3-f4f4f4f4f4f4");
  });

  it("getInvoiceByIdForOwner retourne null pour id non-UUID sans select", async () => {
    const result = await getInvoiceByIdForOwner("not-a-uuid", OWNER_ID);
    expect(result).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("getInvoiceByIdForOwner retourne null quand aucune ligne", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    const result = await getInvoiceByIdForOwner(INV_ID, OWNER_ID);
    expect(result).toBeNull();
  });
});

describe("CUSTOMER_VISIBLE_INVOICE_STATUSES", () => {
  it("includes sent, paid, overdue, cancelled but not draft", () => {
    expect(CUSTOMER_VISIBLE_INVOICE_STATUSES).toEqual(["sent", "paid", "overdue", "cancelled"]);
    expect(CUSTOMER_VISIBLE_INVOICE_STATUSES).not.toContain("draft");
  });
});

describe("listInvoicesByClient", () => {
  it("retourne les factures non-draft du client", async () => {
    const sentInvoice = { ...INV_FIXTURE, status: "sent", clientId: "c1" };
    dbMock.orderBy!.mockResolvedValueOnce([sentInvoice]);
    const result = await listInvoicesByClient("c1");
    expect(result).toEqual([sentInvoice]);
    expect(dbMock.where).toHaveBeenCalled();
  });

  it("isolation cross-client", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([]);
    const result = await listInvoicesByClient("c-other");
    expect(result).toEqual([]);
    expect(dbMock.where).toHaveBeenCalled();
  });

  it("client sans factures retourne tableau vide", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([]);
    const result = await listInvoicesByClient("c-empty");
    expect(result).toEqual([]);
  });

  it("order desc createdAt via listInvoices", async () => {
    dbMock.orderBy!.mockResolvedValueOnce([]);
    await listInvoicesByClient("c1");
    expect(dbMock.orderBy).toHaveBeenCalled();
  });
});

describe("getInvoiceById", () => {
  it("returns invoice when found", async () => {
    dbMock.limit!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await getInvoiceById(INV_ID);
    expect(result).toEqual(INV_FIXTURE);
  });

  it("returns null when not found", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    const result = await getInvoiceById("nope");
    expect(result).toBeNull();
  });

  it("retourne null pour un id non-UUID sans exception", async () => {
    const result = await getInvoiceById("not-a-uuid");
    expect(result).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("retourne null pour une chaîne vide", async () => {
    const result = await getInvoiceById("");
    expect(result).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("retourne null pour un ancien placeholder seed", async () => {
    const result = await getInvoiceById("SEED_DRAFT_INVOICE_ID");
    expect(result).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("retourne null pour un UUID inexistant", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    const result = await getInvoiceById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

describe("getInvoiceByNumber", () => {
  it("returns invoice when found", async () => {
    dbMock.limit!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await getInvoiceByNumber("INV-2026-001");
    expect(result).toEqual(INV_FIXTURE);
  });
});

describe("createInvoice", () => {
  it("creates with auto-generated number", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    dbMock.returning!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await createInvoice({ clientId: "c1", ownerId: OWNER_ID, vatRateBps: 2000 });
    expect(result).toEqual(INV_FIXTURE);
  });

  it("uses provided number", async () => {
    dbMock.returning!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await createInvoice({ clientId: "c1", ownerId: OWNER_ID, vatRateBps: 2000, number: "INV-CUSTOM" });
    expect(result).toEqual(INV_FIXTURE);
  });
});

describe("updateInvoice", () => {
  it("updates allowed fields", async () => {
    dbMock.returning!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await updateInvoice(INV_ID, { notes: "updated" });
    expect(result).toEqual(INV_FIXTURE);
  });

  it("throws if status in patch", async () => {
    await expect(updateInvoice(INV_ID, { status: "sent" } as any)).rejects.toThrow();
  });

  it("throws if totalEurCents in patch", async () => {
    await expect(updateInvoice(INV_ID, { totalEurCents: 500 } as any)).rejects.toThrow();
  });

  it("throws if number in patch", async () => {
    await expect(updateInvoice(INV_ID, { number: "X" } as any)).rejects.toThrow();
  });

  it("throws if paidAt in patch", async () => {
    await expect(updateInvoice(INV_ID, { paidAt: new Date() } as any)).rejects.toThrow();
  });
});

describe("transitionInvoiceStatus", () => {
  it("returns null when invoice not found", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    const result = await transitionInvoiceStatus("nope", "sent");
    expect(result).toBeNull();
  });

  it("throws InvalidInvoiceTransitionError for invalid transition", async () => {
    dbMock.limit!.mockResolvedValueOnce([INV_FIXTURE]);
    await expect(transitionInvoiceStatus(INV_ID, "paid")).rejects.toThrow(InvalidInvoiceTransitionError);
  });

  it("sets issuedAt when transitioning to sent", async () => {
    dbMock.limit!.mockResolvedValueOnce([{ ...INV_FIXTURE, issuedAt: null }]);
    dbMock.returning!.mockResolvedValueOnce([{ ...INV_FIXTURE, status: "sent" }]);
    await transitionInvoiceStatus(INV_ID, "sent");
    const setCall = dbMock.set!.mock.calls[0][0];
    expect(setCall.issuedAt).toBeInstanceOf(Date);
  });

  it("sets paidAt fallback when transitioning to paid and paidAt null", async () => {
    dbMock.limit!.mockResolvedValueOnce([{ ...INV_FIXTURE, status: "sent", paidAt: null }]);
    dbMock.returning!.mockResolvedValueOnce([{ ...INV_FIXTURE, status: "paid" }]);
    await transitionInvoiceStatus(INV_ID, "paid");
    const setCall = dbMock.set!.mock.calls[0][0];
    expect(setCall.paidAt).toBeInstanceOf(Date);
  });

  it("does not overwrite existing paidAt", async () => {
    const existingDate = new Date("2025-01-01");
    dbMock.limit!.mockResolvedValueOnce([{ ...INV_FIXTURE, status: "sent", paidAt: existingDate }]);
    dbMock.returning!.mockResolvedValueOnce([{ ...INV_FIXTURE, status: "paid" }]);
    await transitionInvoiceStatus(INV_ID, "paid");
    const setCall = dbMock.set!.mock.calls[0][0];
    expect(setCall.paidAt).toBeUndefined();
  });
});

describe("deleteInvoice", () => {
  it("calls delete", async () => {
    await deleteInvoice(INV_ID);
    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("createInvoiceFromQuote", () => {
  const QUOTE = {
    id: "q1", ownerId: OWNER_ID, clientId: "c1", projectId: "p1", status: "accepted",
    totalEurCents: 5000, vatRateBps: 2000, notes: "note",
  };

  it("throws when quote not found", async () => {
    dbMock.limit!.mockResolvedValueOnce([]);
    await expect(createInvoiceFromQuote("q1")).rejects.toThrow("Quote not found");
  });

  it("throws InvalidQuoteForInvoicingError if status != accepted", async () => {
    dbMock.limit!.mockResolvedValueOnce([{ ...QUOTE, status: "draft" }]);
    await expect(createInvoiceFromQuote("q1")).rejects.toThrow(InvalidQuoteForInvoicingError);
  });

  it("throws QuoteAlreadyInvoicedError if invoice exists for quote", async () => {
    dbMock.limit!.mockResolvedValueOnce([QUOTE]);
    dbMock.limit!.mockResolvedValueOnce([{ id: "inv-existing" }]);
    await expect(createInvoiceFromQuote("q1")).rejects.toThrow(QuoteAlreadyInvoicedError);
  });

  it("creates invoice and copies items in transaction", async () => {
    dbMock.limit!.mockResolvedValueOnce([QUOTE]);
    dbMock.limit!.mockResolvedValueOnce([]);
    dbMock.limit!.mockResolvedValueOnce([]);
    dbMock.returning!.mockResolvedValueOnce([{ ...INV_FIXTURE, quoteId: "q1" }]);
    dbMock.where!
      .mockReturnValueOnce(dbMock)
      .mockReturnValueOnce(dbMock)
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ description: "item", quantity: 2, unitPriceEurCents: 100, sortOrder: 0 }]);
    const result = await createInvoiceFromQuote("q1");
    expect(result.quoteId).toBe("q1");
    expect(dbMock.transaction).toHaveBeenCalled();
  });

  it("copies_contact_id_from_quote", async () => {
    const quoteWithContact = { ...QUOTE, contactId: "00000000-0000-0000-0000-000000000001" };
    dbMock.limit!.mockResolvedValueOnce([quoteWithContact]);
    dbMock.limit!.mockResolvedValueOnce([]);
    dbMock.limit!.mockResolvedValueOnce([]);
    dbMock.returning!.mockResolvedValueOnce([{ ...INV_FIXTURE, quoteId: "q1", contactId: "00000000-0000-0000-0000-000000000001" }]);
    dbMock.where!
      .mockReturnValueOnce(dbMock)
      .mockReturnValueOnce(dbMock)
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([]);
    await createInvoiceFromQuote("q1");
    const valuesCall = dbMock.values!.mock.calls[0][0];
    expect(valuesCall.contactId).toBe("00000000-0000-0000-0000-000000000001");
  });
});

describe("listInvoiceItems", () => {
  it("returns items for invoice", async () => {
    const items = [{ id: "ii1", invoiceId: INV_ID }];
    dbMock.where!.mockResolvedValueOnce(items);
    const result = await listInvoiceItems(INV_ID);
    expect(result).toEqual(items);
  });
});

describe("addInvoiceItem", () => {
  it("inserts item and recomputes total in transaction", async () => {
    const item = { id: "ii1", invoiceId: INV_ID, description: "x", quantity: 1, unitPriceEurCents: 100, sortOrder: 0 };
    dbMock.returning!.mockResolvedValueOnce([item]);
    dbMock.where!.mockResolvedValueOnce([item]);
    dbMock.returning!.mockResolvedValueOnce([INV_FIXTURE]);
    const result = await addInvoiceItem(INV_ID, { description: "x", quantity: 1, unitPriceEurCents: 100, sortOrder: 0 });
    expect(result).toEqual(item);
    expect(dbMock.transaction).toHaveBeenCalled();
  });
});

describe("updateInvoiceItem", () => {
  it("updates item and recomputes total", async () => {
    const item = { id: "ii1", invoiceId: INV_ID, description: "y", quantity: 2, unitPriceEurCents: 200, sortOrder: 0 };
    dbMock.where!
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([item])
      .mockReturnValueOnce(dbMock);
    dbMock.returning!
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([INV_FIXTURE]);
    const result = await updateInvoiceItem("ii1", { description: "y" });
    expect(result).toEqual(item);
  });

  it("returns null when item not found", async () => {
    dbMock.returning!.mockResolvedValueOnce([]);
    const result = await updateInvoiceItem("nope", { description: "y" });
    expect(result).toBeNull();
  });
});

describe("removeInvoiceItem", () => {
  it("deletes item and recomputes total", async () => {
    dbMock.where!
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(dbMock);
    dbMock.returning!
      .mockResolvedValueOnce([{ id: "ii1", invoiceId: INV_ID }])
      .mockResolvedValueOnce([INV_FIXTURE]);
    await removeInvoiceItem("ii1");
    expect(dbMock.transaction).toHaveBeenCalled();
  });

  it("does nothing when item not found", async () => {
    dbMock.returning!.mockResolvedValueOnce([]);
    await removeInvoiceItem("nope");
  });
});

describe("recomputeInvoiceTotal", () => {
  it("sums item totals and updates invoice", async () => {
    dbMock.where!.mockResolvedValueOnce([
      { quantity: 2, unitPriceEurCents: 100 },
      { quantity: 3, unitPriceEurCents: 200 },
    ]);
    dbMock.returning!.mockResolvedValueOnce([INV_FIXTURE]);
    const total = await recomputeInvoiceTotal(INV_ID);
    expect(total).toBe(800);
  });
});

describe("countUnpaidInvoicesForClient", () => {
  it("count_unpaid_invoices_returns_sent_only", async () => {
    dbMock.where.mockResolvedValueOnce([{ count: 2 }]);
    const result = await countUnpaidInvoicesForClient("c1");
    expect(result).toBe(2);
    expect(dbMock.where).toHaveBeenCalled();
  });

  it("count_unpaid_invoices_returns_zero_when_none_sent", async () => {
    dbMock.where.mockResolvedValueOnce([{ count: 0 }]);
    const result = await countUnpaidInvoicesForClient("c1");
    expect(result).toBe(0);
  });
});
