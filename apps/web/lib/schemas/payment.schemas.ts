import { z } from "zod";

export const paymentMethodSchema = z.enum(["stripe_card", "bank_transfer", "other"]);

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
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

export const listAllPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(["paidAt", "amountCents"]).default("paidAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  method: paymentMethodSchema.optional(),
});

export const recordPaymentFormSchema = createPaymentSchema.omit({ invoiceId: true });
export type RecordPaymentFormValues = z.infer<typeof recordPaymentFormSchema>;

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentCreateValues = z.infer<typeof createPaymentSchema>;
export type ListPaymentsByInvoiceValues = z.infer<typeof listPaymentsByInvoiceSchema>;
export type ListAllPaymentsValues = z.infer<typeof listAllPaymentsSchema>;
