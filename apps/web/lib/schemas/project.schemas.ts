import { z } from "zod";

export const projectStatusSchema = z.enum([
  "draft",
  "active",
  "on_hold",
  "delivered",
  "cancelled",
]);

export const createProjectSchema = z.object({
  clientId: z.string().uuid("Client invalide."),
  name: z.string().min(1, "Le nom est requis."),
  slug: z.string().optional(),
  status: projectStatusSchema.optional(),
  description: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema
  .omit({ status: true })
  .partial();

export const transitionStatusSchema = z.object({
  status: projectStatusSchema,
});

export type ProjectCreateValues = z.infer<typeof createProjectSchema>;
export type ProjectUpdateValues = z.infer<typeof updateProjectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
