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
  getBusinessProfile,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Quote } from "@saas/db";
import { generateAndStoreQuotePdf } from "@/lib/pdf/generate-quote-pdf";

class BusinessProfileRequiredError extends Error {
  constructor() {
    super(
      "Configurez votre profil entreprise (raison sociale, SIRET…) avant d'émettre un devis.",
    );
    this.name = "BusinessProfileRequiredError";
  }
}

export async function createQuoteAction(
  input: QuoteCreateValues,
): Promise<ActionResult<Quote>> {
  return withAdmin(async (user) => {
    const data = createQuoteSchema.parse(input);
    const quote = await createQuote({ ...data, ownerId: user.id });
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

    if (data.targetStatus === "sent") {
      const current = await getQuoteById(id);
      if (!current) throw new Error("QUOTE_NOT_FOUND");
      const profile = await getBusinessProfile(current.ownerId);
      if (!profile) throw new BusinessProfileRequiredError();
    }

    const quote = await transitionQuoteStatus(id, data.targetStatus);
    if (quote === null) throw new Error("QUOTE_NOT_FOUND");

    if (data.targetStatus === "sent") {
      try {
        await generateAndStoreQuotePdf(id);
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "quote.pdf.generation_failed",
            quoteId: id,
            message: (err as Error).message,
          }),
        );
      }
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
