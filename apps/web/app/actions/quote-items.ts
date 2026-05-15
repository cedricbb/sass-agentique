"use server";

import { revalidatePath } from "next/cache";
import {
  addQuoteItemSchema,
  updateQuoteItemSchema,
} from "@/lib/schemas/quote-item.schemas";
import {
  addQuoteItem,
  updateQuoteItem,
  removeQuoteItem,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { QuoteItem } from "@saas/db";

export async function addQuoteItemAction(
  quoteId: string,
  input: unknown,
): Promise<ActionResult<QuoteItem>> {
  return withAdmin(async () => {
    const parsed = addQuoteItemSchema.parse(input);
    const item = await addQuoteItem(quoteId, parsed);
    revalidatePath(`/admin/quotes/${quoteId}`);
    return item;
  });
}

export async function updateQuoteItemAction(
  itemId: string,
  input: unknown,
): Promise<ActionResult<QuoteItem>> {
  return withAdmin(async () => {
    const parsed = updateQuoteItemSchema.parse(input);
    const item = await updateQuoteItem(itemId, parsed);
    if (item === null) {
      throw new Error("QUOTE_ITEM_NOT_FOUND");
    }
    revalidatePath(`/admin/quotes/${item.quoteId}`);
    return item;
  });
}

export async function removeQuoteItemAction(
  itemId: string,
  quoteId: string,
): Promise<ActionResult<{ success: true }>> {
  return withAdmin(async () => {
    await removeQuoteItem(itemId);
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { success: true };
  });
}
