import { z } from "zod";

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  dueAt: z.coerce.date().optional(),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  notes: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  notes: z.string().nullable().optional(),
});

export const transitionInvoiceStatusSchema = z.object({
  targetStatus: invoiceStatusSchema,
});

export const createInvoiceFromQuoteSchema = z.object({
  quoteId: z.string().uuid(),
});

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type InvoiceCreateValues = z.infer<typeof createInvoiceSchema>;
export type InvoiceUpdateValues = z.infer<typeof updateInvoiceSchema>;
export type InvoiceTransitionValues = z.infer<typeof transitionInvoiceStatusSchema>;
export type InvoiceFromQuoteValues = z.infer<typeof createInvoiceFromQuoteSchema>;
