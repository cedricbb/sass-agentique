"use server";

import { revalidatePath } from "next/cache";
import {
  addInvoiceItemSchema,
  updateInvoiceItemSchema,
} from "@/lib/schemas/invoice-item.schemas";
import {
  addInvoiceItem,
  updateInvoiceItem,
  removeInvoiceItem,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { InvoiceItem } from "@saas/db";

export async function addInvoiceItemAction(
  invoiceId: string,
  input: unknown,
): Promise<ActionResult<InvoiceItem>> {
  return withAdmin(async () => {
    const parsed = addInvoiceItemSchema.parse(input);
    const item = await addInvoiceItem(invoiceId, parsed);
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return item;
  });
}

export async function updateInvoiceItemAction(
  itemId: string,
  input: unknown,
): Promise<ActionResult<InvoiceItem>> {
  return withAdmin(async () => {
    const parsed = updateInvoiceItemSchema.parse(input);
    const item = await updateInvoiceItem(itemId, parsed);
    if (item === null) {
      throw new Error("INVOICE_ITEM_NOT_FOUND");
    }
    revalidatePath(`/admin/invoices/${item.invoiceId}`);
    return item;
  });
}

export async function removeInvoiceItemAction(
  itemId: string,
  invoiceId: string,
): Promise<ActionResult<{ success: true }>> {
  return withAdmin(async () => {
    await removeInvoiceItem(itemId);
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { success: true };
  });
}
