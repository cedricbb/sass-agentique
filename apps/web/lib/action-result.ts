import { ZodError } from "zod";
import { requireAdmin, requireCustomer, type AdminUser, type CustomerScope } from "@/lib/auth";

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
  CustomerNoClientError: { code: "CUSTOMER_NO_CLIENT", status: 403 },
  ForbiddenScopeError: { code: "FORBIDDEN_SCOPE", status: 404 },
  FileTooLargeError: { code: "FILE_TOO_LARGE", status: 400 },
  InvalidPdfMagicBytesError: { code: "INVALID_PDF", status: 400 },
  R2UploadError: { code: "R2_UPLOAD_FAILED", status: 500 },
};

function isRedirectError(error: unknown): boolean {
  if (!(error instanceof Error) || !("digest" in error)) return false;
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
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
  if (typeof error === "object" && error !== null && "code" in error && (error as Record<string, unknown>).code === "23505") {
    return fail("CONTRACT_DUPLICATE", "Doublon détecté.", 409);
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

export async function withCustomer<T>(
  fn: (scope: CustomerScope) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const scope = await requireCustomer();
    const data = await fn(scope);
    return ok(data);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return handleActionError(error);
  }
}
