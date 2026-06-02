import { z } from "zod";

export const inviteCustomerSchema = z.object({
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const addClientContactSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export type AddClientContactInput = z.infer<typeof addClientContactSchema>;

export type InviteCustomerInput = z.infer<typeof inviteCustomerSchema>;

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
