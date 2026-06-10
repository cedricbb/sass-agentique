import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => {
  const PaymentDeletionOnPaidInvoiceError = class extends Error {
    constructor(invoiceId: string) {
      super(`Cannot delete payment on paid invoice "${invoiceId}"`);
      this.name = "PaymentDeletionOnPaidInvoiceError";
    }
  };
  Object.defineProperty(PaymentDeletionOnPaidInvoiceError, "name", {
    value: "PaymentDeletionOnPaidInvoiceError",
  });
  return {
    paymentService: {
      createPayment: vi.fn(),
      deletePayment: vi.fn(),
      listPaymentsByInvoice: vi.fn(),
      listAllPayments: vi.fn(),
      getPaymentById: vi.fn(),
      computeInvoiceBalance: vi.fn(),
      PaymentDeletionOnPaidInvoiceError,
    },
    getInvoiceById: vi.fn(),
    PaymentDeletionOnPaidInvoiceError,
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createPaymentAction,
  deletePaymentAction,
  listPaymentsByInvoiceAction,
  listAllPaymentsAction,
  getPaymentByIdAction,
} from "../payments";
import { paymentService, getInvoiceById } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreatePayment = vi.mocked(paymentService.createPayment);
const mockedDeletePayment = vi.mocked(paymentService.deletePayment);
const mockedListPayments = vi.mocked(paymentService.listPaymentsByInvoice);
const mockedListAllPayments = vi.mocked(paymentService.listAllPayments);
const mockedGetPaymentById = vi.mocked(paymentService.getPaymentById);
const mockedComputeBalance = vi.mocked(paymentService.computeInvoiceBalance);
const mockedGetInvoiceById = vi.mocked(getInvoiceById);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const INVOICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const PAYMENT_ID = "660e8400-e29b-41d4-a716-446655440000";

const fakeAdmin = {
  id: "admin-1",
  email: "admin@test.com",
  role: "admin",
  name: "Admin",
} as unknown as Awaited<ReturnType<typeof requireAdmin>>;

const mockInvoice = {
  id: INVOICE_ID,
  clientId: "aaa",
  projectId: null,
  quoteId: null,
  number: "INV-2026-001",
  status: "sent",
  dueAt: null,
  vatRateBps: 2000,
  totalEurCents: 10000,
  paidAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPayment = {
  id: PAYMENT_ID,
  invoiceId: INVOICE_ID,
  amountCents: 5000,
  method: "stripe_card",
  paidAt: new Date(),
  externalRef: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validInput = {
  invoiceId: INVOICE_ID,
  amountCents: 5000,
  method: "stripe_card" as const,
  paidAt: new Date(),
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

describe("createPaymentAction", () => {
  it("T1 — happy path partial payment", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    mockedComputeBalance.mockResolvedValue({ totalCents: 10000, paidCents: 0, balanceCents: 10000, isFullyPaid: false });
    mockedCreatePayment.mockResolvedValue({ payment: mockPayment as never, invoiceMarkedAsPaid: false });
    const result = await createPaymentAction(validInput);
    expect(result).toEqual({ ok: true, data: { payment: mockPayment, invoiceMarkedAsPaid: false } });
  });

  it("T2 — happy path fully paid", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    mockedComputeBalance.mockResolvedValue({ totalCents: 10000, paidCents: 5000, balanceCents: 5000, isFullyPaid: false });
    mockedCreatePayment.mockResolvedValue({ payment: mockPayment as never, invoiceMarkedAsPaid: true });
    const result = await createPaymentAction({ ...validInput, amountCents: 5000 });
    expect(result).toEqual({ ok: true, data: { payment: mockPayment, invoiceMarkedAsPaid: true } });
  });

  it("T3 — invoice not found", async () => {
    mockedGetInvoiceById.mockResolvedValue(null as never);
    const result = await createPaymentAction(validInput);
    expect(result).toMatchObject({ ok: false, error: { code: "INVOICE_NOT_FOUND", status: 404 } });
  });

  it("T4 — invoice status draft", async () => {
    mockedGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: "draft" } as never);
    const result = await createPaymentAction(validInput);
    expect(result).toMatchObject({ ok: false, error: { code: "PAYMENT_INVOICE_NOT_OPEN", status: 400 } });
  });

  it("T5 — invoice status overdue", async () => {
    mockedGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: "overdue" } as never);
    const result = await createPaymentAction(validInput);
    expect(result).toMatchObject({ ok: false, error: { code: "PAYMENT_INVOICE_NOT_OPEN", status: 400 } });
  });

  it("T6 — invoice status paid", async () => {
    mockedGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: "paid" } as never);
    const result = await createPaymentAction(validInput);
    expect(result).toMatchObject({ ok: false, error: { code: "PAYMENT_INVOICE_NOT_OPEN", status: 400 } });
  });

  it("T7 — invoice status cancelled", async () => {
    mockedGetInvoiceById.mockResolvedValue({ ...mockInvoice, status: "cancelled" } as never);
    const result = await createPaymentAction(validInput);
    expect(result).toMatchObject({ ok: false, error: { code: "PAYMENT_INVOICE_NOT_OPEN", status: 400 } });
  });

  it("T8 — over-payment", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    mockedComputeBalance.mockResolvedValue({ totalCents: 10000, paidCents: 10000, balanceCents: 0, isFullyPaid: false });
    const result = await createPaymentAction({ ...validInput, amountCents: 3000 });
    expect(result).toMatchObject({ ok: false, error: { code: "PAYMENT_OVERPAYMENT", status: 400 } });
  });

  it("T8bis — accepts exact TTC payment (no overpayment)", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    mockedComputeBalance.mockResolvedValue({ totalCents: 10000, paidCents: 0, balanceCents: 10000, isFullyPaid: false });
    mockedCreatePayment.mockResolvedValue({ payment: mockPayment as never, invoiceMarkedAsPaid: false });
    const result = await createPaymentAction({ ...validInput, amountCents: 12000 });
    expect(result).toMatchObject({ ok: true });
  });

  it("T9 — zod fail negative amount", async () => {
    const result = await createPaymentAction({ ...validInput, amountCents: -100 });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("T10 — zod fail invalid method", async () => {
    const result = await createPaymentAction({ ...validInput, method: "cash" as never });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("T11 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createPaymentAction(validInput)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T12 — revalidatePath called twice", async () => {
    mockedGetInvoiceById.mockResolvedValue(mockInvoice as never);
    mockedComputeBalance.mockResolvedValue({ totalCents: 10000, paidCents: 0, balanceCents: 10000, isFullyPaid: false });
    mockedCreatePayment.mockResolvedValue({ payment: mockPayment as never, invoiceMarkedAsPaid: false });
    await createPaymentAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/invoices/${INVOICE_ID}`);
  });
});

describe("deletePaymentAction", () => {
  it("T13 — happy path", async () => {
    mockedDeletePayment.mockResolvedValue(true);
    const result = await deletePaymentAction(PAYMENT_ID, INVOICE_ID);
    expect(result).toEqual({ ok: true, data: { deleted: true } });
  });

  it("T14 — invoice paid → PAYMENT_LOCKED_BY_INVOICE", async () => {
    const ErrorClass = (paymentService as unknown as { PaymentDeletionOnPaidInvoiceError: new (id: string) => Error }).PaymentDeletionOnPaidInvoiceError;
    mockedDeletePayment.mockRejectedValue(new ErrorClass(INVOICE_ID));
    const result = await deletePaymentAction(PAYMENT_ID, INVOICE_ID);
    expect(result).toMatchObject({ ok: false, error: { code: "PAYMENT_LOCKED_BY_INVOICE", status: 409 } });
  });

  it("T15 — payment not found returns ok deleted true", async () => {
    mockedDeletePayment.mockResolvedValue(false);
    const result = await deletePaymentAction(PAYMENT_ID, INVOICE_ID);
    expect(result).toEqual({ ok: true, data: { deleted: true } });
  });

  it("T16 — revalidatePath called twice", async () => {
    mockedDeletePayment.mockResolvedValue(true);
    await deletePaymentAction(PAYMENT_ID, INVOICE_ID);
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/invoices");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/invoices/${INVOICE_ID}`);
  });
});

describe("listPaymentsByInvoiceAction", () => {
  it("T17 — happy path", async () => {
    mockedListPayments.mockResolvedValue([mockPayment as never]);
    const result = await listPaymentsByInvoiceAction(INVOICE_ID);
    expect(result).toEqual({ ok: true, data: [mockPayment] });
  });
});

describe("getPaymentByIdAction", () => {
  it("T18 — found", async () => {
    mockedGetPaymentById.mockResolvedValue(mockPayment as never);
    const result = await getPaymentByIdAction(PAYMENT_ID);
    expect(result).toEqual({ ok: true, data: mockPayment });
  });

  it("T19 — not found", async () => {
    mockedGetPaymentById.mockResolvedValue(null);
    const result = await getPaymentByIdAction(PAYMENT_ID);
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("listAllPaymentsAction", () => {
  it("happy path returns success + data", async () => {
    const data = [mockPayment];
    mockedListAllPayments.mockResolvedValue(data as never);
    const result = await listAllPaymentsAction({ page: 1, perPage: 50, sort: "paidAt", order: "desc" });
    expect(result).toEqual({ ok: true, data });
  });

  it("invalid params (page=-1) returns error", async () => {
    const result = await listAllPaymentsAction({ page: -1, perPage: 50, sort: "paidAt", order: "desc" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("non-admin user redirected", async () => {
    const err = makeRedirectError();
    mockedRequireAdmin.mockRejectedValue(err);
    await expect(listAllPaymentsAction({ page: 1, perPage: 50, sort: "paidAt", order: "desc" })).rejects.toThrow();
  });
});
