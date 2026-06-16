"use server";

import { revalidatePath } from "next/cache";
import { getQuoteById, transitionQuoteStatus, InvalidQuoteTransitionError } from "@saas/services";
import { withCustomer, type ActionResult } from "@/lib/action-result";
import { assertClientOwnershipOrThrow } from "@/lib/auth";
import type { Quote } from "@saas/db";

export async function acceptCustomerQuoteAction(
  quoteId: string,
): Promise<ActionResult<Quote>> {
  return withCustomer(async (scope) => {
    const raw = await getQuoteById(quoteId);
    const quote = assertClientOwnershipOrThrow(raw, scope);
    if (quote.status !== "sent") {
      throw new InvalidQuoteTransitionError(quote.status, "accepted");
    }
    const updated = await transitionQuoteStatus(quoteId, "accepted");
    revalidatePath("/account/quotes");
    revalidatePath(`/account/quotes/${quoteId}`);
    return updated!;
  });
}

export async function declineCustomerQuoteAction(
  quoteId: string,
): Promise<ActionResult<Quote>> {
  return withCustomer(async (scope) => {
    const raw = await getQuoteById(quoteId);
    const quote = assertClientOwnershipOrThrow(raw, scope);
    if (quote.status !== "sent") {
      throw new InvalidQuoteTransitionError(quote.status, "declined");
    }
    const updated = await transitionQuoteStatus(quoteId, "declined");
    revalidatePath("/account/quotes");
    revalidatePath(`/account/quotes/${quoteId}`);
    return updated!;
  });
}
