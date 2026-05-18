import { z } from "zod";

export const paymentMethodSchema = z.enum(["stripe_card", "bank_transfer", "other"]);

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountEurCents: z.number().int().positive(),
  method: paymentMethodSchema,
  paidAt: z.coerce.date(),
  externalRef: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const listPaymentsByInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});

export const paymentIdSchema = z.object({
  id: z.string().uuid(),
});

export const deletePaymentSchema = paymentIdSchema;

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentCreateValues = z.infer<typeof createPaymentSchema>;
export type ListPaymentsByInvoiceValues = z.infer<typeof listPaymentsByInvoiceSchema>;
