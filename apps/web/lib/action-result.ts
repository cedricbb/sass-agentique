import { ZodError } from "zod";
import { requireAdmin, type AdminUser } from "@/lib/auth";

export type ActionError = { code: string; message: string; status: number };

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: string, message: string, status: number): ActionResult<never> {
  return { ok: false, error: { code, message, status } };
}

const ERROR_MAP: Record<string, { code: string; status: number }> = {
  InvalidQuoteTransitionError: { code: "QUOTE_INVALID_TRANSITION", status: 409 },
  InvalidQuoteForInvoicingError: { code: "QUOTE_NOT_INVOICABLE", status: 409 },
  QuoteAlreadyInvoicedError: { code: "QUOTE_ALREADY_INVOICED", status: 409 },
  InvalidInvoiceTransitionError: { code: "INVOICE_INVALID_TRANSITION", status: 409 },
  PaymentDeletionOnPaidInvoiceError: { code: "PAYMENT_LOCKED_BY_INVOICE", status: 409 },
  InvalidFilePathError: { code: "REPORT_INVALID_PATH", status: 400 },
  ClientAlreadyHasActiveContractError: { code: "CONTRACT_DUPLICATE", status: 409 },
  InvalidContractTransitionError: { code: "CONTRACT_INVALID_TRANSITION", status: 409 },
  ContractNotInStripeAutoModeError: { code: "CONTRACT_NOT_STRIPE_AUTO", status: 409 },
  InvalidProjectTransitionError: { code: "PROJECT_INVALID_TRANSITION", status: 409 },
  StripeServiceError: { code: "STRIPE_ERROR", status: 502 },
};

function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as any).digest === "string" &&
    (error as any).digest.startsWith("NEXT_REDIRECT")
  );
}

export function handleActionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Données invalides.", 400);
  }
  if (error instanceof Error) {
    const mapped = ERROR_MAP[error.constructor.name];
    if (mapped) {
      return fail(mapped.code, error.message, mapped.status);
    }
  }
  console.error(error);
  return fail("INTERNAL_ERROR", "Une erreur est survenue.", 500);
}

export async function withAdmin<T>(
  fn: (user: AdminUser) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await requireAdmin();
    const data = await fn(user);
    return ok(data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return handleActionError(error);
  }
}
