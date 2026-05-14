import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  clientId: z.string().uuid(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const transitionStatusSchema = z.object({
  id: z.string().uuid(),
  newStatus: z.enum(["draft", "active", "on_hold", "delivered", "cancelled"]),
});

export type ProjectCreateValues = z.infer<typeof createProjectSchema>;
export type ProjectUpdateValues = z.infer<typeof updateProjectSchema>;
