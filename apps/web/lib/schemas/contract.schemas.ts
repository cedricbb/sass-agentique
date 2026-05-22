import { z } from "zod";

export const createContractSchema = z.object({
  clientId: z.string().uuid(),
  prestationId: z.string().uuid(),
  billingMode: z.enum(["stripe_auto", "manual_invoice"]),
  monthlyPriceEurCents: z.coerce.number().int().positive(),
  startedAt: z.coerce.date(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
