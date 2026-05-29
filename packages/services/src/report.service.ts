import { db, type Report, type NewReport, reportKindEnum, reports } from "@saas/db";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReportKind = (typeof reportKindEnum.enumValues)[number];

export type UpdateReportPatch = Omit<Partial<NewReport>, "clientId" | "issuedAt">;

export class InvalidFilePathError extends Error {
  override name = "InvalidFilePathError";
  constructor(message = "filePath must not be empty") {
    super(message);
  }
}

function validateFilePath(filePath: string): string {
  const trimmed = filePath.trim();
  if (trimmed.length === 0) {
    throw new InvalidFilePathError();
  }
  return trimmed;
}

export async function listReportsByClient(
  clientId: string,
  opts?: { kind?: ReportKind; issuedOnly?: boolean },
): Promise<Report[]> {
  const conditions = [eq(reports.clientId, clientId)];
  if (opts?.kind) {
    conditions.push(eq(reports.kind, opts.kind));
  }
  if (opts?.issuedOnly) {
    conditions.push(isNotNull(reports.issuedAt));
  }
  return db
    .select()
    .from(reports)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(reports.createdAt));
}

export async function listReportsByProject(
  projectId: string,
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.projectId, projectId))
    .orderBy(desc(reports.createdAt));
}

export async function listAllReports(
  opts?: { kind?: ReportKind; undatedOnly?: boolean },
): Promise<Report[]> {
  const conditions = [];
  if (opts?.kind) {
    conditions.push(eq(reports.kind, opts.kind));
  }
  if (opts?.undatedOnly) {
    conditions.push(isNull(reports.issuedAt));
  }
  const condition =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);
  return db
    .select()
    .from(reports)
    .where(condition)
    .orderBy(desc(reports.createdAt));
}

export async function getReportById(id: string): Promise<Report | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getReportByTitle(title: string): Promise<Report | null> {
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.title, title))
    .limit(1);
  return rows[0] ?? null;
}

export async function createReport(input: NewReport): Promise<Report> {
  const trimmedPath = validateFilePath(input.filePath);
  const rows = await db
    .insert(reports)
    .values({ ...input, filePath: trimmedPath })
    .returning();
  return rows[0];
}

export async function updateReport(
  id: string,
  patch: UpdateReportPatch,
): Promise<Report | null> {
  if ("clientId" in patch) {
    throw new Error("clientId cannot be updated");
  }
  if ("issuedAt" in patch) {
    throw new Error("issuedAt cannot be updated via updateReport");
  }
  if (patch.filePath !== undefined) {
    patch = { ...patch, filePath: validateFilePath(patch.filePath) };
  }
  const rows = await db
    .update(reports)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(reports.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function markReportIssued(
  id: string,
  issuedAt?: Date,
): Promise<Report | null> {
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  const report = rows[0] ?? null;
  if (!report) return null;
  if (report.issuedAt) return report;

  const updated = await db
    .update(reports)
    .set({ issuedAt: issuedAt ?? new Date(), updatedAt: new Date() })
    .where(and(eq(reports.id, id), isNull(reports.issuedAt)))
    .returning();
  return updated[0] ?? report;
}

export async function deleteReport(
  id: string,
): Promise<{ deletedReport: Report | null }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    const report = rows[0] ?? null;
    if (!report) return { deletedReport: null };
    await tx.delete(reports).where(eq(reports.id, id));
    return { deletedReport: report };
  });
}
