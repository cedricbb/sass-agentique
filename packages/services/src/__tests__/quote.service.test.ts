import { describe, it, expect, vi, beforeEach } from "vitest";

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
  quotes: { id: "id", clientId: "clientId", number: "number", status: "status", totalEurCents: "totalEurCents" },
  quoteItems: { id: "id", quoteId: "quoteId", unitPriceEurCents: "unitPriceEurCents", quantity: "quantity" },
  quoteStatusEnum: { enumValues: ["draft", "sent", "accepted", "declined", "expired"] },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
  desc: vi.fn((...args: unknown[]) => ({ op: "desc", args })),
  like: vi.fn((...args: unknown[]) => ({ op: "like", args })),
  sql: vi.fn((...args: unknown[]) => ({ op: "sql", args })),
  sum: vi.fn((...args: unknown[]) => ({ op: "sum", args })),
}));

import {
  VALID_QUOTE_TRANSITIONS,
  canTransitionQuote,
  computeQuoteTtc,
  InvalidQuoteTransitionError,
  generateQuoteNumber,
  listQuotes,
  getQuoteById,
  getQuoteByNumber,
  createQuote,
  updateQuote,
  transitionQuoteStatus,
  deleteQuote,
  listQuoteItems,
  addQuoteItem,
  updateQuoteItem,
  removeQuoteItem,
  recomputeQuoteTotal,
} from "../quote.service";

const QUOTE_FIXTURE = {
  id: "q1",
  clientId: "c1",
  projectId: null,
  number: "Q-2026-001",
  status: "draft" as const,
  issuedAt: null,
  expiresAt: null,
  acceptedAt: null,
  totalEurCents: 10000,
  vatRateBps: 2000,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ITEM_FIXTURE = {
  id: "qi1",
  quoteId: "q1",
  prestationId: null,
  description: "Dev work",
  quantity: 2,
  unitPriceEurCents: 5000,
  sortOrder: 0,
};

beforeEach(() => {
  dbMock = makeDrizzleMock();
  vi.clearAllMocks();
});

describe("VALID_QUOTE_TRANSITIONS", () => {
  it("has 5 keys with correct values", () => {
    expect(Object.keys(VALID_QUOTE_TRANSITIONS)).toHaveLength(5);
    expect(VALID_QUOTE_TRANSITIONS.draft).toEqual(["sent"]);
    expect(VALID_QUOTE_TRANSITIONS.sent).toEqual(["accepted", "declined", "expired"]);
    expect(VALID_QUOTE_TRANSITIONS.accepted).toEqual([]);
    expect(VALID_QUOTE_TRANSITIONS.declined).toEqual([]);
    expect(VALID_QUOTE_TRANSITIONS.expired).toEqual([]);
  });
});

describe("canTransitionQuote", () => {
  it("allows draft → sent", () => {
    expect(canTransitionQuote("draft", "sent")).toBe(true);
  });

  it("rejects draft → accepted", () => {
    expect(canTransitionQuote("draft", "accepted")).toBe(false);
  });

  it("rejects accepted → draft (terminal)", () => {
    expect(canTransitionQuote("accepted", "draft")).toBe(false);
  });
});

describe("computeQuoteTtc", () => {
  it("computes amounts correctly", () => {
    const result = computeQuoteTtc({ totalEurCents: 10000, vatRateBps: 2000 });
    expect(result).toEqual({
      totalHtCents: 10000,
      vatCents: 2000,
      totalTtcCents: 12000,
    });
  });

  it("handles vatRateBps = 0", () => {
    const result = computeQuoteTtc({ totalEurCents: 5000, vatRateBps: 0 });
    expect(result).toEqual({
      totalHtCents: 5000,
      vatCents: 0,
      totalTtcCents: 5000,
    });
  });

  it("rounds correctly (2050 bps on 100 cents)", () => {
    const result = computeQuoteTtc({ totalEurCents: 100, vatRateBps: 2050 });
    expect(result.vatCents).toBe(21);
    expect(result.totalTtcCents).toBe(121);
  });
});

describe("InvalidQuoteTransitionError", () => {
  it("has correct message and name", () => {
    const err = new InvalidQuoteTransitionError("draft", "accepted");
    expect(err.message).toBe('Invalid transition from "draft" to "accepted"');
    expect(err.name).toBe("InvalidQuoteTransitionError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("generateQuoteNumber", () => {
  it("returns Q-YYYY-001 when no quotes exist", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const num = await generateQuoteNumber(2026);
    expect(num).toBe("Q-2026-001");
  });

  it("increments last number", async () => {
    dbMock.limit.mockResolvedValueOnce([{ number: "Q-2026-005" }]);
    const num = await generateQuoteNumber(2026);
    expect(num).toBe("Q-2026-006");
  });

  it("throws on corrupted suffix", async () => {
    dbMock.limit.mockResolvedValueOnce([{ number: "Q-2026-ABC" }]);
    await expect(generateQuoteNumber(2026)).rejects.toThrow("Cannot parse last quote number");
  });
});

describe("listQuotes", () => {
  it("lists all quotes without filters", async () => {
    dbMock.orderBy.mockResolvedValueOnce([QUOTE_FIXTURE]);
    const result = await listQuotes();
    expect(result).toEqual([QUOTE_FIXTURE]);
    expect(dbMock.orderBy).toHaveBeenCalled();
  });

  it("filters by clientId", async () => {
    dbMock.orderBy.mockResolvedValueOnce([QUOTE_FIXTURE]);
    await listQuotes({ clientId: "c1" });
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
  });

  it("filters by status array", async () => {
    dbMock.orderBy.mockResolvedValueOnce([]);
    await listQuotes({ status: ["draft", "sent"] });
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
  });
});

describe("getQuoteById", () => {
  it("returns quote when found", async () => {
    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    const result = await getQuoteById("q1");
    expect(result).toEqual(QUOTE_FIXTURE);
  });

  it("returns null when not found", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await getQuoteById("missing");
    expect(result).toBeNull();
  });
});

describe("getQuoteByNumber", () => {
  it("returns quote when found", async () => {
    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    const result = await getQuoteByNumber("Q-2026-001");
    expect(result).toEqual(QUOTE_FIXTURE);
  });
});

describe("createQuote", () => {
  it("creates with auto-generated number", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    dbMock.returning.mockResolvedValueOnce([QUOTE_FIXTURE]);
    const result = await createQuote({ clientId: "c1" });
    expect(result).toEqual(QUOTE_FIXTURE);
  });

  it("creates with provided number", async () => {
    dbMock.returning.mockResolvedValueOnce([QUOTE_FIXTURE]);
    const result = await createQuote({ clientId: "c1", number: "Q-CUSTOM-001" });
    expect(result).toEqual(QUOTE_FIXTURE);
  });

  it("retries on 23505 when number is auto-generated", async () => {
    const collision = Object.assign(new Error("unique violation"), { code: "23505" });
    dbMock.limit
      .mockResolvedValueOnce([{ number: "Q-2026-001" }])
      .mockResolvedValueOnce([{ number: "Q-2026-002" }]);
    dbMock.returning
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce([{ ...QUOTE_FIXTURE, number: "Q-2026-003" }]);
    const result = await createQuote({ clientId: "c1" });
    expect(result.number).toBe("Q-2026-003");
    expect(dbMock.returning).toHaveBeenCalledTimes(2);
  });

  it("propagates 23505 immediately when number is provided explicitly", async () => {
    const collision = Object.assign(new Error("unique violation"), { code: "23505" });
    dbMock.returning.mockRejectedValueOnce(collision);
    await expect(createQuote({ clientId: "c1", number: "Q-2026-001" })).rejects.toThrow("unique violation");
    expect(dbMock.returning).toHaveBeenCalledTimes(1);
  });

  it("propagates error after 3 retries exhausted", async () => {
    const collision = Object.assign(new Error("unique violation"), { code: "23505" });
    dbMock.limit.mockResolvedValue([{ number: "Q-2026-001" }]);
    dbMock.returning.mockRejectedValue(collision);
    await expect(createQuote({ clientId: "c1" })).rejects.toThrow("unique violation");
    expect(dbMock.returning).toHaveBeenCalledTimes(3);
  });
});

describe("updateQuote", () => {
  it("updates allowed fields", async () => {
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, notes: "updated" }]);
    const result = await updateQuote("q1", { notes: "updated" });
    expect(result?.notes).toBe("updated");
  });

  it("throws when patch contains status", async () => {
    await expect(updateQuote("q1", { status: "sent" } as any)).rejects.toThrow(
      "Use dedicated methods",
    );
  });

  it("throws when patch contains totalEurCents", async () => {
    await expect(updateQuote("q1", { totalEurCents: 999 } as any)).rejects.toThrow(
      "Use dedicated methods",
    );
  });

  it("throws when patch contains number", async () => {
    await expect(updateQuote("q1", { number: "X" } as any)).rejects.toThrow(
      "Use dedicated methods",
    );
  });
});

describe("transitionQuoteStatus", () => {
  it("returns null for nonexistent quote", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await transitionQuoteStatus("missing", "sent");
    expect(result).toBeNull();
  });

  it("throws on invalid transition", async () => {
    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    await expect(transitionQuoteStatus("q1", "accepted")).rejects.toThrow(
      InvalidQuoteTransitionError,
    );
  });

  it("sets issuedAt on draft→sent", async () => {
    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, status: "sent" }]);
    await transitionQuoteStatus("q1", "sent");
    const setCall = dbMock.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("issuedAt");
    expect(setCall.status).toBe("sent");
  });

  it("sets acceptedAt on sent→accepted", async () => {
    const sentQuote = { ...QUOTE_FIXTURE, status: "sent" as const, issuedAt: new Date() };
    dbMock.limit.mockResolvedValueOnce([sentQuote]);
    dbMock.returning.mockResolvedValueOnce([{ ...sentQuote, status: "accepted" }]);
    await transitionQuoteStatus("q1", "accepted");
    const setCall = dbMock.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("acceptedAt");
  });
});

describe("deleteQuote", () => {
  it("deletes by id", async () => {
    await deleteQuote("q1");
    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("listQuoteItems", () => {
  it("returns items for a quote", async () => {
    dbMock.where.mockResolvedValueOnce([ITEM_FIXTURE]);
    const result = await listQuoteItems("q1");
    expect(result).toEqual([ITEM_FIXTURE]);
  });
});

describe("addQuoteItem", () => {
  it("adds item and recomputes total in transaction", async () => {
    dbMock.returning.mockResolvedValueOnce([ITEM_FIXTURE]);
    dbMock.where.mockResolvedValueOnce([ITEM_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, totalEurCents: 10000 }]);
    const result = await addQuoteItem("q1", {
      description: "Dev work",
      quantity: 2,
      unitPriceEurCents: 5000,
    });
    expect(result).toEqual(ITEM_FIXTURE);
    expect(dbMock.transaction).toHaveBeenCalled();
  });
});

describe("updateQuoteItem", () => {
  it("updates item and recomputes total in transaction", async () => {
    const updated = { ...ITEM_FIXTURE, quantity: 3 };
    // where calls: 1=intermediate(update item), 2=terminal(select items), 3=intermediate(update quote)
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([updated])
      .mockReturnValueOnce(dbMock);
    dbMock.returning
      .mockResolvedValueOnce([updated])
      .mockResolvedValueOnce([{ ...QUOTE_FIXTURE, totalEurCents: 15000 }]);
    const result = await updateQuoteItem("qi1", { quantity: 3 });
    expect(result).toEqual(updated);
    expect(dbMock.transaction).toHaveBeenCalled();
  });

  it("returns null when item not found", async () => {
    dbMock.returning.mockResolvedValueOnce([]);
    const result = await updateQuoteItem("missing", { quantity: 1 });
    expect(result).toBeNull();
  });
});

describe("removeQuoteItem", () => {
  it("removes item and recomputes total", async () => {
    // where calls: 1=intermediate(delete item), 2=terminal(select items), 3=intermediate(update quote)
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(dbMock);
    dbMock.returning
      .mockResolvedValueOnce([ITEM_FIXTURE])
      .mockResolvedValueOnce([{ ...QUOTE_FIXTURE, totalEurCents: 0 }]);
    await removeQuoteItem("qi1");
    expect(dbMock.transaction).toHaveBeenCalled();
  });

  it("skips recompute when item not found", async () => {
    dbMock.returning.mockResolvedValueOnce([]);
    await removeQuoteItem("missing");
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("recomputeQuoteTotal", () => {
  it("sums items and updates quote", async () => {
    dbMock.where.mockResolvedValueOnce([
      { quantity: 2, unitPriceEurCents: 5000 },
      { quantity: 1, unitPriceEurCents: 3000 },
    ]);
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, totalEurCents: 13000 }]);
    const total = await recomputeQuoteTotal("q1");
    expect(total).toBe(13000);
  });
});
