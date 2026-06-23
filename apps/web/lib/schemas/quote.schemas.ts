import { z } from "zod";

export const quoteStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

export const createQuoteSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  contactId: z.string().uuid().nullable().optional(),
  expiresAt: z.coerce.date().optional(),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  notes: z.string().optional(),
});

export const updateQuoteSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  notes: z.string().nullable().optional(),
});

export const transitionStatusSchema = z.object({
  targetStatus: quoteStatusSchema,
});

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type QuoteCreateValues = z.infer<typeof createQuoteSchema>;
export type QuoteUpdateValues = z.infer<typeof updateQuoteSchema>;
export type QuoteTransitionValues = z.infer<typeof transitionStatusSchema>;
