import { z } from "zod";

export const reportKindSchema = z.enum(["delivery", "monthly", "audit", "other"]);

export const createReportSchema = z.object({
  clientId: z.string().uuid("clientId doit être un UUID"),
  projectId: z.string().uuid("projectId doit être un UUID").optional().nullable(),
  title: z.string().trim().min(1, "Le titre est requis").max(255),
  kind: reportKindSchema.default("delivery"),
  summary: z.string().trim().max(2000).optional().nullable(),
  filePath: z.string().trim().min(1, "filePath est requis"),
});

export const updateReportSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    kind: reportKindSchema.optional(),
    projectId: z.string().uuid().optional().nullable(),
    summary: z.string().trim().max(2000).optional().nullable(),
  })
  .refine(
    (data) => Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined).length > 0,
    "Au moins un champ doit être modifié",
  );

export const listReportsParamsSchema = z.object({
  kind: reportKindSchema.optional(),
  undatedOnly: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateReportInput = z.input<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsParams = z.infer<typeof listReportsParamsSchema>;
