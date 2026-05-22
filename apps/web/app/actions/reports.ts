"use server";

import { revalidatePath } from "next/cache";
import {
  createReportSchema,
  updateReportSchema,
  listReportsParamsSchema,
  transitionReportSchema,
  deleteReportSchema,
  uploadReportSchema,
  type CreateReportInput,
  type UpdateReportInput,
  type ListReportsParams,
  type TransitionReportInput,
  type UploadReportInput,
} from "@/lib/schemas/report.schemas";
import { reportService } from "@saas/services";
import { withAdmin, ok, fail, handleActionError, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import {
  deletePdfFromR2,
  uploadPdfToR2,
  buildReportKey,
  assertPdfSize,
  isPdfMagicBytes,
  InvalidPdfMagicBytesError,
} from "@/lib/storage/r2";
import type { Report } from "@saas/db";

export async function createReport(
  input: CreateReportInput,
): Promise<ActionResult<Report>> {
  return withAdmin(async (user) => {
    const data = createReportSchema.parse(input);
    const report = await reportService.createReport({
      ...data,
      ownerId: user.id,
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

export async function markReportIssuedAction(
  id: string,
  input?: TransitionReportInput,
): Promise<ActionResult<Report>> {
  return withAdmin(async () => {
    const data = transitionReportSchema.parse(input ?? {});
    const report = await reportService.markReportIssued(id, data.issuedAt);
    if (report === null) throw new Error("REPORT_NOT_FOUND");
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/reports/${id}`);
    return report;
  });
}

function extractFileFromFormData(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

async function validatePdfBuffer(file: File): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer());
  assertPdfSize(buffer);
  if (!isPdfMagicBytes(buffer)) {
    throw new InvalidPdfMagicBytesError();
  }
  return buffer;
}

async function createReportWithRollback(
  key: string,
  metadata: UploadReportInput,
  { ownerId }: { ownerId: string },
): Promise<Report> {
  try {
    return await reportService.createReport({
      clientId: metadata.clientId,
      projectId: metadata.projectId ?? null,
      title: metadata.title,
      kind: metadata.kind,
      filePath: key,
      summary: metadata.summary ?? null,
      ownerId,
    });
  } catch (createError) {
    try {
      await deletePdfFromR2(key);
    } catch (rollbackError) {
      console.error("[uploadAndCreateReportAction] rollback R2 cleanup failed", key, rollbackError);
    }
    throw createError;
  }
}

export async function uploadAndCreateReportAction(
  formData: FormData,
): Promise<ActionResult<Report>> {
  try {
    const user = await requireAdmin();

    const file = extractFileFromFormData(formData);
    if (!file) return fail("FILE_REQUIRED", "Un fichier PDF est requis.", 400);

    const rawMetadata = {
      clientId: formData.get("clientId") as string,
      projectId: (formData.get("projectId") as string) || undefined,
      title: formData.get("title") as string,
      kind: formData.get("kind") as string,
      summary: (formData.get("summary") as string) || undefined,
    };
    const metadata = uploadReportSchema.parse(rawMetadata);

    const buffer = await validatePdfBuffer(file);
    const key = buildReportKey();
    await uploadPdfToR2(key, buffer);

    const report = await createReportWithRollback(key, metadata, { ownerId: user.id });
    revalidatePath("/admin/reports");
    return ok(report);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteReportAction(
  id: string,
): Promise<ActionResult<{ deleted: boolean; fileCleanupAttempted: boolean }>> {
  try {
    await requireAdmin();
    deleteReportSchema.parse({ id });

    const existing = await reportService.getReportById(id);
    if (existing === null) {
      return fail("REPORT_NOT_FOUND", "Rapport introuvable.", 404);
    }
    if (existing.issuedAt !== null) {
      return fail("REPORT_DELETE_LOCKED", "Un rapport émis ne peut pas être supprimé.", 409);
    }

    const result = await reportService.deleteReport(id);
    if (result.deletedReport === null) {
      return fail("REPORT_NOT_FOUND", "Rapport introuvable.", 404);
    }

    let fileCleanupAttempted = true;
    try {
      await deletePdfFromR2(result.deletedReport.filePath);
    } catch (e) {
      console.error("[deleteReportAction] R2 cleanup failed", id, e);
      fileCleanupAttempted = false;
    }

    revalidatePath("/admin/reports");
    return ok({ deleted: true, fileCleanupAttempted });
  } catch (error) {
    return handleActionError(error);
  }
}
