import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, fail, handleActionError, withAdmin } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth";

const mockedRequireAdmin = vi.mocked(requireAdmin);

describe("ok", () => {
  it("wraps data in success result", () => {
    const result = ok({ id: 1 });
    expect(result).toEqual({ ok: true, data: { id: 1 } });
  });

  it("handles undefined (void actions)", () => {
    const result = ok(undefined);
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe("fail", () => {
  it("returns error result with code, message, status", () => {
    const result = fail("MY_CODE", "boom", 422);
    expect(result).toEqual({
      ok: false,
      error: { code: "MY_CODE", message: "boom", status: 422 },
    });
  });
});

describe("handleActionError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("maps ZodError to VALIDATION_ERROR 400", async () => {
    const { ZodError } = await import("zod");
    const err = new ZodError([]);
    const result = handleActionError(err);
    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Données invalides.", status: 400 },
    });
  });

  it("maps known domain errors via constructor.name", () => {
    class InvalidQuoteTransitionError extends Error {
      constructor() {
        super("bad transition");
        this.name = "InvalidQuoteTransitionError";
      }
    }
    Object.defineProperty(InvalidQuoteTransitionError, "name", { value: "InvalidQuoteTransitionError" });
    const result = handleActionError(new InvalidQuoteTransitionError());
    expect(result).toEqual({
      ok: false,
      error: { code: "QUOTE_INVALID_TRANSITION", message: "bad transition", status: 409 },
    });
  });

  it("maps StripeServiceError to STRIPE_ERROR 502", () => {
    class StripeServiceError extends Error {
      constructor() {
        super("stripe down");
        this.name = "StripeServiceError";
      }
    }
    Object.defineProperty(StripeServiceError, "name", { value: "StripeServiceError" });
    const result = handleActionError(new StripeServiceError());
    expect(result).toEqual({
      ok: false,
      error: { code: "STRIPE_ERROR", message: "stripe down", status: 502 },
    });
  });

  it("maps InvalidFilePathError to REPORT_INVALID_PATH 400", () => {
    class InvalidFilePathError extends Error {
      constructor() {
        super("bad path");
        this.name = "InvalidFilePathError";
      }
    }
    Object.defineProperty(InvalidFilePathError, "name", { value: "InvalidFilePathError" });
    const result = handleActionError(new InvalidFilePathError());
    expect(result).toEqual({
      ok: false,
      error: { code: "REPORT_INVALID_PATH", message: "bad path", status: 400 },
    });
  });

  it("falls back to INTERNAL_ERROR 500 for unknown errors", () => {
    const result = handleActionError(new Error("oops"));
    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Une erreur est survenue.", status: 500 },
    });
    expect(console.error).toHaveBeenCalledWith(expect.any(Error));
  });

  it("handles non-Error values as INTERNAL_ERROR", () => {
    const result = handleActionError("string error");
    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Une erreur est survenue.", status: 500 },
    });
    expect(console.error).toHaveBeenCalledWith("string error");
  });
});

describe("23505 unique_violation filet", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("AC10 — maps Postgres 23505 to CONTRACT_DUPLICATE 409", () => {
    const pgError = { code: "23505", message: "unique_violation" };
    const result = handleActionError(pgError);
    expect(result).toEqual({
      ok: false,
      error: { code: "CONTRACT_DUPLICATE", message: "Doublon détecté.", status: 409 },
    });
  });

  it("does not match non-23505 codes", () => {
    const otherError = { code: "23503", message: "foreign_key_violation" };
    const result = handleActionError(otherError);
    expect(result).toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Une erreur est survenue.", status: 500 },
    });
  });
});

describe("ERROR_MAP coverage", () => {
  const cases = [
    ["InvalidQuoteTransitionError", "QUOTE_INVALID_TRANSITION", 409],
    ["InvalidQuoteForInvoicingError", "QUOTE_NOT_INVOICABLE", 409],
    ["QuoteAlreadyInvoicedError", "QUOTE_ALREADY_INVOICED", 409],
    ["InvalidInvoiceTransitionError", "INVOICE_INVALID_TRANSITION", 409],
    ["PaymentDeletionOnPaidInvoiceError", "PAYMENT_LOCKED_BY_INVOICE", 409],
    ["InvalidFilePathError", "REPORT_INVALID_PATH", 400],
    ["ClientAlreadyHasActiveContractError", "CONTRACT_DUPLICATE", 409],
    ["InvalidContractTransitionError", "CONTRACT_INVALID_TRANSITION", 409],
    ["ContractNotInStripeAutoModeError", "CONTRACT_NOT_STRIPE_AUTO", 409],
    ["InvalidProjectTransitionError", "PROJECT_INVALID_TRANSITION", 409],
    ["StripeServiceError", "STRIPE_ERROR", 502],
  ] as const;

  it.each(cases)("%s → %s %d", (className, code, status) => {
    const err = new Error("msg");
    Object.defineProperty(err.constructor, "name", { value: className, configurable: true });
    const result = handleActionError(err);
    expect(result).toEqual({
      ok: false,
      error: { code, message: "msg", status },
    });
  });
});

describe("withAdmin", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns ok with data on success", async () => {
    mockedRequireAdmin.mockResolvedValue({ id: "u1", role: "admin" } as unknown as Awaited<ReturnType<typeof requireAdmin>>);
    const result = await withAdmin(async (user) => ({ userId: user.id }));
    expect(result).toEqual({ ok: true, data: { userId: "u1" } });
  });

  it("re-throws NEXT_REDIRECT errors", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/dashboard;push" });
    mockedRequireAdmin.mockRejectedValue(redirectError);
    await expect(withAdmin(async () => "x")).rejects.toThrow(redirectError);
  });

  it("catches domain errors via handleActionError", async () => {
    mockedRequireAdmin.mockResolvedValue({ id: "u1", role: "admin" } as unknown as Awaited<ReturnType<typeof requireAdmin>>);
    const err = new Error("bad");
    Object.defineProperty(err.constructor, "name", { value: "StripeServiceError", configurable: true });
    const result = await withAdmin(async () => {
      throw err;
    });
    expect(result).toEqual({
      ok: false,
      error: { code: "STRIPE_ERROR", message: "bad", status: 502 },
    });
  });
});

describe("type contracts", () => {
  it("ActionResult discriminates on ok field", () => {
    const success: ActionResult<number> = { ok: true, data: 42 };
    const failure: ActionResult<number> = {
      ok: false,
      error: { code: "X", message: "y", status: 400 },
    };
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });
});
