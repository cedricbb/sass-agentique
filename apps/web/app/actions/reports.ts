"use server";

import { revalidatePath } from "next/cache";
import {
  createReportSchema,
  updateReportSchema,
  listReportsParamsSchema,
  type CreateReportInput,
  type UpdateReportInput,
  type ListReportsParams,
} from "@/lib/schemas/report.schemas";
import { reportService } from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Report } from "@saas/db";

export async function createReport(
  input: CreateReportInput,
): Promise<ActionResult<Report>> {
  return withAdmin(async () => {
    const data = createReportSchema.parse(input);
    const report = await reportService.createReport({
      ...data,
      projectId: data.projectId ?? null,
      summary: data.summary ?? null,
    });
    revalidatePath("/admin/reports");
    return report;
  });
}

export async function updateReport(
  id: string,
  patch: UpdateReportInput,
): Promise<ActionResult<Report | null>> {
  return withAdmin(async () => {
    const data = updateReportSchema.parse(patch);
    const report = await reportService.updateReport(id, data);
    revalidatePath("/admin/reports");
    return report;
  });
}

export async function listReports(
  params?: ListReportsParams,
): Promise<ActionResult<{ items: Report[]; total: number; page: number; pageSize: number }>> {
  return withAdmin(async () => {
    const { kind, undatedOnly, page, pageSize } = listReportsParamsSchema.parse(params ?? {});
    const all = await reportService.listAllReports({ kind, undatedOnly });
    const total = all.length;
    const offset = (page - 1) * pageSize;
    const items = all.slice(offset, offset + pageSize);
    return { items, total, page, pageSize };
  });
}
