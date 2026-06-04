import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "innerJoin", "where", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "orderBy",
    "offset",
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
  payments: { id: "id", invoiceId: "invoiceId", amountEurCents: "amountEurCents", paidAt: "paidAt", method: "method", externalRef: "externalRef" },
  invoices: { id: "id", status: "status", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps", clientId: "clientId", number: "number" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  sql: vi.fn((...args: unknown[]) => ({ op: "sql", args })),
  asc: vi.fn((...args: unknown[]) => ({ op: "asc", args })),
  desc: vi.fn((...args: unknown[]) => ({ op: "desc", args })),
  ilike: vi.fn((...args: unknown[]) => ({ op: "ilike", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
}));

vi.mock("../invoice.service", () => ({
  transitionInvoiceStatus: vi.fn(),
}));

vi.mock("../invoice.shared", () => ({
  computeInvoiceTtc: vi.fn((inv: { totalEurCents: number; vatRateBps: number }) => {
    const totalHtCents = inv.totalEurCents;
    const vatCents = Math.round((totalHtCents * inv.vatRateBps) / 10000);
    return { totalHtCents, vatCents, totalTtcCents: totalHtCents + vatCents };
  }),
}));

import {
  listPaymentsByInvoice,
  listAllPayments,
  getPaymentById,
  createPayment,
  deletePayment,
  computeInvoiceBalance,
  recomputePaidAtForInvoice,
  PaymentDeletionOnPaidInvoiceError,
  listPaymentsForCustomerPortal,
} from "../payment.service";
import * as invoiceService from "../invoice.service";

beforeEach(() => {
  dbMock = makeDrizzleMock();
  vi.clearAllMocks();
});

describe("listPaymentsByInvoice", () => {
  it("returns payments filtered and sorted by paidAt ASC", async () => {
    const payments = [
      { id: "p1", paidAt: new Date("2026-01-01") },
      { id: "p2", paidAt: new Date("2026-01-02") },
    ];
    dbMock.orderBy.mockResolvedValueOnce(payments);

    const result = await listPaymentsByInvoice("inv-1");
    expect(result).toEqual(payments);
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
  });
});

describe("getPaymentById", () => {
  it("returns payment if found", async () => {
    const payment = { id: "p1", amountEurCents: 1000 };
    dbMock.limit.mockResolvedValueOnce([payment]);

    const result = await getPaymentById("p1");
    expect(result).toEqual(payment);
  });

  it("returns null if not found", async () => {
    dbMock.limit.mockResolvedValueOnce([]);

    const result = await getPaymentById("missing");
    expect(result).toBeNull();
  });
});

describe("createPayment", () => {
  const INPUT = { invoiceId: "inv-1", amountEurCents: 500, method: "bank_transfer", paidAt: new Date() } as any;

  it("inserts and returns invoiceMarkedAsPaid: false when paidCents < totalCents", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 500 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit.mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 500 }]);

    const result = await createPayment(INPUT);
    expect(result.payment).toEqual(payment);
    expect(result.invoiceMarkedAsPaid).toBe(false);
    expect(dbMock.transaction).toHaveBeenCalled();
  });

  it("calls transitionInvoiceStatus and returns invoiceMarkedAsPaid: true when fully paid", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 1200 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit
      .mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }])
      .mockResolvedValueOnce([{ status: "sent" }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 1200 }])
      .mockReturnValueOnce(dbMock);

    const result = await createPayment({ ...INPUT, amountEurCents: 1200 });
    expect(result.invoiceMarkedAsPaid).toBe(true);
    expect(invoiceService.transitionInvoiceStatus).toHaveBeenCalledWith("inv-1", "paid");
  });

  it("tolerates over-payment and triggers paid transition", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 2000 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit
      .mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }])
      .mockResolvedValueOnce([{ status: "sent" }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 2000 }])
      .mockReturnValueOnce(dbMock);

    const result = await createPayment({ ...INPUT, amountEurCents: 2000 });
    expect(result.invoiceMarkedAsPaid).toBe(true);
  });

  it("does NOT call transitionInvoiceStatus if invoice already paid", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 1200 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit
      .mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }])
      .mockResolvedValueOnce([{ status: "paid" }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 1200 }])
      .mockReturnValueOnce(dbMock);

    const result = await createPayment({ ...INPUT, amountEurCents: 1200 });
    expect(result.invoiceMarkedAsPaid).toBe(false);
    expect(invoiceService.transitionInvoiceStatus).not.toHaveBeenCalled();
  });

  it("does NOT auto-paid when paidCents covers HT but not TTC", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 1000 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit.mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 1000 }]);

    const result = await createPayment({ ...INPUT, amountEurCents: 1000 });
    expect(result.invoiceMarkedAsPaid).toBe(false);
    expect(invoiceService.transitionInvoiceStatus).not.toHaveBeenCalled();
  });

  it("auto-paid when paidCents covers TTC exactly", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 1200 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit
      .mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }])
      .mockResolvedValueOnce([{ status: "sent" }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 1200 }])
      .mockReturnValueOnce(dbMock);

    const result = await createPayment({ ...INPUT, amountEurCents: 1200 });
    expect(result.invoiceMarkedAsPaid).toBe(true);
    expect(invoiceService.transitionInvoiceStatus).toHaveBeenCalledWith("inv-1", "paid");
  });

  it("auto-paid on accumulated payments reaching TTC", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 1000 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit
      .mockResolvedValueOnce([{ totalEurCents: 5000, vatRateBps: 2000 }])
      .mockResolvedValueOnce([{ status: "sent" }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 6000 }])
      .mockReturnValueOnce(dbMock);

    const result = await createPayment({ ...INPUT, amountEurCents: 1000 });
    expect(result.invoiceMarkedAsPaid).toBe(true);
    expect(invoiceService.transitionInvoiceStatus).toHaveBeenCalledWith("inv-1", "paid");
  });

  it("uses db.transaction", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 100 };
    dbMock.returning.mockResolvedValueOnce([payment]);
    dbMock.limit.mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 100 }]);

    await createPayment({ ...INPUT, amountEurCents: 100 });
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("deletePayment", () => {
  it("returns true and deletes when invoice.status !== paid", async () => {
    dbMock.limit.mockResolvedValueOnce([{
      id: "p1", invoiceId: "inv-1", invoiceStatus: "sent",
    }]);

    const result = await deletePayment("p1");
    expect(result).toBe(true);
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it("throws PaymentDeletionOnPaidInvoiceError when invoice.status === paid", async () => {
    dbMock.limit.mockResolvedValueOnce([{
      id: "p1", invoiceId: "inv-1", invoiceStatus: "paid",
    }]);

    await expect(deletePayment("p1")).rejects.toThrow(PaymentDeletionOnPaidInvoiceError);
  });

  it("returns false when payment not found", async () => {
    dbMock.limit.mockResolvedValueOnce([]);

    const result = await deletePayment("missing");
    expect(result).toBe(false);
  });
});

describe("computeInvoiceBalance", () => {
  it("returns correct 4 fields for nominal case", async () => {
    dbMock.limit.mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 600 }]);

    const result = await computeInvoiceBalance("inv-1");
    expect(result).toEqual({
      totalCents: 1000,
      paidCents: 600,
      balanceCents: 400,
      isFullyPaid: false,
    });
  });

  it("returns negative balanceCents and isFullyPaid: true for over-payment", async () => {
    dbMock.limit.mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 1500 }]);

    const result = await computeInvoiceBalance("inv-1");
    expect(result).toEqual({
      totalCents: 1000,
      paidCents: 1500,
      balanceCents: -500,
      isFullyPaid: true,
    });
  });

  it("returns zeros for non-existent invoice", async () => {
    dbMock.limit.mockResolvedValueOnce([]);

    const result = await computeInvoiceBalance("missing");
    expect(result).toEqual({
      totalCents: 0,
      paidCents: 0,
      balanceCents: 0,
      isFullyPaid: false,
    });
  });
});

describe("recomputePaidAtForInvoice", () => {
  it("calls transitionInvoiceStatus if fully paid and not already paid; no-op otherwise", async () => {
    dbMock.limit
      .mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }])
      .mockResolvedValueOnce([{ status: "sent" }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 1200 }])
      .mockReturnValueOnce(dbMock);

    const result = await recomputePaidAtForInvoice("inv-1");
    expect(result).toEqual({ wasMarkedAsPaid: true });
    expect(invoiceService.transitionInvoiceStatus).toHaveBeenCalledWith("inv-1", "paid");

    vi.clearAllMocks();
    dbMock = makeDrizzleMock();
    dbMock.limit.mockResolvedValueOnce([{ totalEurCents: 1000, vatRateBps: 2000 }]);
    dbMock.where
      .mockReturnValueOnce(dbMock)
      .mockResolvedValueOnce([{ sum: 500 }]);

    const result2 = await recomputePaidAtForInvoice("inv-1");
    expect(result2).toEqual({ wasMarkedAsPaid: false });
    expect(invoiceService.transitionInvoiceStatus).not.toHaveBeenCalled();
  });
});

describe("listPaymentsForCustomerPortal", () => {
  it("returns_only_payments_for_given_client_ordered_by_paid_at_desc", async () => {
    const data = [
      { id: "p2", invoiceId: "inv-1", amountEurCents: 2000, paidAt: new Date("2026-02-01"), invoiceNumber: "INV-002" },
      { id: "p1", invoiceId: "inv-1", amountEurCents: 1000, paidAt: new Date("2026-01-01"), invoiceNumber: "INV-001" },
    ];
    dbMock.orderBy.mockResolvedValueOnce(data);

    const result = await listPaymentsForCustomerPortal("client-A");
    expect(result).toEqual(data);
    expect(dbMock.orderBy).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
  });

  it("returns_payment_fields_with_invoice_number", async () => {
    const data = [
      { id: "p1", invoiceId: "inv-1", amountEurCents: 5000, paidAt: new Date("2026-01-01"), method: "bank_transfer", externalRef: null, invoiceNumber: "INV-042" },
    ];
    dbMock.orderBy.mockResolvedValueOnce(data);

    const result = await listPaymentsForCustomerPortal("client-A");
    expect(result[0]).toHaveProperty("invoiceNumber", "INV-042");
    expect(result[0]).toHaveProperty("id", "p1");
    expect(result[0]).toHaveProperty("invoiceId", "inv-1");
    expect(result[0]).toHaveProperty("amountEurCents", 5000);
  });

  it("returns_empty_array_when_no_payments_for_client", async () => {
    dbMock.orderBy.mockResolvedValueOnce([]);

    const result = await listPaymentsForCustomerPortal("client-empty");
    expect(result).toEqual([]);
  });

  it("excludes_payments_from_other_clients_invoices", async () => {
    const clientAData = [
      { id: "p1", invoiceId: "inv-A", amountEurCents: 1000, invoiceNumber: "INV-A-001" },
    ];
    dbMock.orderBy.mockResolvedValueOnce(clientAData);

    const result = await listPaymentsForCustomerPortal("client-A");
    expect(result.every(p => p.invoiceId === "inv-A")).toBe(true);
    expect(result.find(p => p.invoiceId === "inv-B")).toBeUndefined();
  });

  it("uses_inner_join_with_client_id_filter", async () => {
    const { eq: eqMock, desc: descMock } = await import("drizzle-orm");
    dbMock.orderBy.mockResolvedValueOnce([]);

    await listPaymentsForCustomerPortal("client-X");

    expect(dbMock.innerJoin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ op: "eq" }),
    );
    expect(dbMock.where).toHaveBeenCalledWith(
      expect.objectContaining({ op: "eq", args: expect.arrayContaining(["clientId", "client-X"]) }),
    );
    expect(dbMock.orderBy).toHaveBeenCalledWith(
      expect.objectContaining({ op: "desc" }),
    );
  });
});

describe("listAllPayments", () => {
  it("returns empty array when no payments", async () => {
    dbMock.offset.mockResolvedValueOnce([]);
    const result = await listAllPayments();
    expect(result).toEqual([]);
  });

  it("returns payments sorted desc paidAt", async () => {
    const data = [
      { id: "p1", paidAt: new Date("2026-02-01") },
      { id: "p2", paidAt: new Date("2026-01-01") },
    ];
    dbMock.offset.mockResolvedValueOnce(data);
    const result = await listAllPayments();
    expect(result).toEqual(data);
    expect(dbMock.orderBy).toHaveBeenCalled();
  });

  it("returns Payment[] with all fields present", async () => {
    const payment = { id: "p1", invoiceId: "inv-1", amountEurCents: 5000, method: "bank_transfer", paidAt: new Date() };
    dbMock.offset.mockResolvedValueOnce([payment]);
    const result = await listAllPayments();
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("invoiceId");
    expect(result[0]).toHaveProperty("amountEurCents");
    expect(result[0]).toHaveProperty("method");
    expect(result[0]).toHaveProperty("paidAt");
  });

  it("filters by method", async () => {
    const data = [{ id: "p1", method: "stripe_card" }];
    dbMock.offset.mockResolvedValueOnce(data);
    const result = await listAllPayments({ method: "stripe_card" });
    expect(result).toEqual(data);
    expect(dbMock.where).toHaveBeenCalled();
  });

  it("filters by search on externalRef", async () => {
    const data = [{ id: "p1", externalRef: "pi_123" }];
    dbMock.offset.mockResolvedValueOnce(data);
    const result = await listAllPayments({ search: "pi_123" });
    expect(result).toEqual(data);
    expect(dbMock.where).toHaveBeenCalled();
  });
});
