import { z } from "zod";

export const addQuoteItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(9999),
  unitPriceEurCents: z.number().int().min(0).max(99999999),
  prestationId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateQuoteItemSchema = addQuoteItemSchema.partial();

export type QuoteItemAddValues = z.infer<typeof addQuoteItemSchema>;
export type QuoteItemUpdateValues = z.infer<typeof updateQuoteItemSchema>;
