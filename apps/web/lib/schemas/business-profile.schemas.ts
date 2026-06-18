import { z } from "zod";

export const businessProfileSchema = z.object({
  name: z.string().min(1),
  legalForm: z.string().optional(),
  siret: z.string().regex(/^\d{14}$/).optional().or(z.literal("")),
  tvaIntra: z.string().optional().or(z.literal("")),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  iban: z.string().optional().or(z.literal("")),
  bic: z.string().optional().or(z.literal("")),
});

export type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>;
