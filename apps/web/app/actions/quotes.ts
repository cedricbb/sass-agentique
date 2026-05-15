"use server";

import { revalidatePath } from "next/cache";
import {
  createQuoteSchema,
  updateQuoteSchema,
  transitionStatusSchema,
  type QuoteCreateValues,
  type QuoteUpdateValues,
  type QuoteTransitionValues,
  type QuoteStatus,
} from "@/lib/schemas/quote.schemas";
import {
  createQuote,
  updateQuote,
  transitionQuoteStatus,
  getQuoteById,
  listQuotes,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Quote } from "@saas/db";

export async function createQuoteAction(
  input: QuoteCreateValues,
): Promise<ActionResult<Quote>> {
  return withAdmin(async () => {
    const data = createQuoteSchema.parse(input);
    const quote = await createQuote(data);
    revalidatePath("/admin/quotes");
    return quote;
  });
}

export async function updateQuoteAction(
  id: string,
  input: QuoteUpdateValues,
): Promise<ActionResult<Quote | null>> {
  return withAdmin(async () => {
    const data = updateQuoteSchema.parse(input);
    const quote = await updateQuote(id, data);
    if (quote === null) {
      throw new Error("QUOTE_NOT_FOUND");
    }
    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/quotes/${id}`);
    return quote;
  });
}

export async function transitionQuoteStatusAction(
  id: string,
  input: QuoteTransitionValues,
): Promise<ActionResult<Quote | null>> {
  return withAdmin(async () => {
    const data = transitionStatusSchema.parse(input);
    const quote = await transitionQuoteStatus(id, data.targetStatus);
    if (quote === null) {
      throw new Error("QUOTE_NOT_FOUND");
    }
    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/quotes/${id}`);
    return quote;
  });
}

export async function getQuoteByIdAction(
  id: string,
): Promise<ActionResult<Quote | null>> {
  return withAdmin(async () => {
    return getQuoteById(id);
  });
}

export async function listQuotesAction(
  opts?: { clientId?: string; status?: QuoteStatus | QuoteStatus[] },
): Promise<ActionResult<Quote[]>> {
  return withAdmin(async () => {
    return listQuotes(opts);
  });
}
