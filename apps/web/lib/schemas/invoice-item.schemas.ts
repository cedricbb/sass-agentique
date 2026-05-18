import { z } from "zod";

export const addInvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(9999),
  unitPriceEurCents: z.number().int().min(0).max(99999999),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateInvoiceItemSchema = addInvoiceItemSchema.partial();

export type InvoiceItemAddValues = z.infer<typeof addInvoiceItemSchema>;
export type InvoiceItemUpdateValues = z.infer<typeof updateInvoiceItemSchema>;
