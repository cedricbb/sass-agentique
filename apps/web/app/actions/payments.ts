"use server";

import { revalidatePath } from "next/cache";
import {
  createPaymentSchema,
  paymentIdSchema,
  listAllPaymentsSchema,
  type PaymentCreateValues,
  type ListAllPaymentsValues,
} from "@/lib/schemas/payment.schemas";
import { paymentService, getInvoiceById } from "@saas/services";
import {
  withAdmin,
  ok,
  fail,
  handleActionError,
  type ActionResult,
} from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import type { Payment } from "@saas/db";

export async function createPaymentAction(
  input: PaymentCreateValues,
): Promise<ActionResult<{ payment: Payment; invoiceMarkedAsPaid: boolean }>> {
  try {
    await requireAdmin();
    const data = createPaymentSchema.parse(input);

    const invoice = await getInvoiceById(data.invoiceId);
    if (!invoice) {
      return fail("INVOICE_NOT_FOUND", "Invoice introuvable.", 404);
    }
    if (invoice.status !== "sent") {
      return fail(
        "PAYMENT_INVOICE_NOT_OPEN",
        "L'invoice n'est pas au statut envoyée.",
        400,
      );
    }

    const balance = await paymentService.computeInvoiceBalance(data.invoiceId);
    if (data.amountEurCents + balance.paidCents > balance.totalCents) {
      return fail(
        "PAYMENT_OVERPAYMENT",
        "Le montant dépasse le solde restant.",
        400,
      );
    }

    const result = await paymentService.createPayment(data);
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${data.invoiceId}`);
    return ok(result);
  } catch (error) {
    if (
      error instanceof Error &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      ((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return handleActionError(error);
  }
}

export async function deletePaymentAction(
  id: string,
  invoiceId: string,
): Promise<ActionResult<{ deleted: true }>> {
  return withAdmin(async () => {
    paymentIdSchema.parse({ id });
    await paymentService.deletePayment(id);
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { deleted: true };
  });
}

export async function listPaymentsByInvoiceAction(
  invoiceId: string,
): Promise<ActionResult<Payment[]>> {
  return withAdmin(async () => {
    return paymentService.listPaymentsByInvoice(invoiceId);
  });
}

export async function getPaymentByIdAction(
  id: string,
): Promise<ActionResult<Payment | null>> {
  return withAdmin(async () => {
    return paymentService.getPaymentById(id);
  });
}

export async function listAllPaymentsAction(
  input: ListAllPaymentsValues,
): Promise<ActionResult<Payment[]>> {
  return withAdmin(async () => {
    const parsed = listAllPaymentsSchema.parse(input);
    const limit = parsed.perPage;
    const offset = (parsed.page - 1) * parsed.perPage;
    return paymentService.listAllPayments({
      limit,
      offset,
      method: parsed.method,
      search: parsed.search,
    });
  });
}
