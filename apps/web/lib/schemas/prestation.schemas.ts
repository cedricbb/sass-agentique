import { z } from "zod";

export const createPrestationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  basePriceEur: z.coerce.number().min(0).default(0),
  kind: z.enum(["one_shot", "recurring"]).default("one_shot"),
});

export const updatePrestationSchema = createPrestationSchema.partial();

export type PrestationCreateValues = z.infer<typeof createPrestationSchema>;
export type PrestationUpdateValues = z.infer<typeof updatePrestationSchema>;
