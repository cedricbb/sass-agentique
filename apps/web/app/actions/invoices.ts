"use server";

import { revalidatePath } from "next/cache";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  transitionInvoiceStatusSchema,
  createInvoiceFromQuoteSchema,
  type InvoiceCreateValues,
  type InvoiceUpdateValues,
  type InvoiceTransitionValues,
  type InvoiceFromQuoteValues,
  type InvoiceStatus,
} from "@/lib/schemas/invoice.schemas";
import {
  createInvoice,
  updateInvoice,
  transitionInvoiceStatus,
  getInvoiceById,
  listInvoices,
  createInvoiceFromQuote,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Invoice } from "@saas/db";

export async function createInvoiceAction(
  input: InvoiceCreateValues,
): Promise<ActionResult<Invoice>> {
  return withAdmin(async (user) => {
    const data = createInvoiceSchema.parse(input);
    const invoice = await createInvoice({ ...data, ownerId: user.id });
    revalidatePath("/admin/invoices");
    return invoice;
  });
}

export async function updateInvoiceAction(
  id: string,
  input: InvoiceUpdateValues,
): Promise<ActionResult<Invoice | null>> {
  return withAdmin(async () => {
    const data = updateInvoiceSchema.parse(input);
    const invoice = await updateInvoice(id, data);
    if (invoice === null) {
      throw new Error("INVOICE_NOT_FOUND");
    }
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    return invoice;
  });
}

export async function transitionInvoiceStatusAction(
  id: string,
  input: InvoiceTransitionValues,
): Promise<ActionResult<Invoice | null>> {
  return withAdmin(async () => {
    const data = transitionInvoiceStatusSchema.parse(input);
    const invoice = await transitionInvoiceStatus(id, data.targetStatus);
    if (invoice === null) {
      throw new Error("INVOICE_NOT_FOUND");
    }
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    return invoice;
  });
}

export async function createInvoiceFromQuoteAction(
  input: InvoiceFromQuoteValues,
): Promise<ActionResult<Invoice>> {
  return withAdmin(async () => {
    const data = createInvoiceFromQuoteSchema.parse(input);
    const invoice = await createInvoiceFromQuote(data.quoteId);
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/quotes/${data.quoteId}`);
    return invoice;
  });
}

export async function getInvoiceByIdAction(
  id: string,
): Promise<ActionResult<Invoice | null>> {
  return withAdmin(async () => {
    return getInvoiceById(id);
  });
}

export async function listInvoicesAction(
  opts?: { clientId?: string; status?: InvoiceStatus | InvoiceStatus[] },
): Promise<ActionResult<Invoice[]>> {
  return withAdmin(async () => {
    return listInvoices(opts);
  });
}
