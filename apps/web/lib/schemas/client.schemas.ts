import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(["company", "individual"]).default("company"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
