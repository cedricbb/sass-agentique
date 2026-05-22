import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  reportService: {
    createReport: vi.fn(),
    updateReport: vi.fn(),
    listAllReports: vi.fn(),
    markReportIssued: vi.fn(),
    deleteReport: vi.fn(),
    getReportById: vi.fn(),
  },
}));

vi.mock("@/lib/storage/r2", () => {
  class R2DeleteError extends Error {
    constructor(msg: string | Error) {
      super(typeof msg === "string" ? msg : msg.message);
      this.name = "R2DeleteError";
    }
  }
  const FileTooLargeError = (() => {
    function FileTooLargeError(this: Error) {
      const e = new Error("File too large");
      Object.setPrototypeOf(e, FileTooLargeError.prototype);
      e.name = "FileTooLargeError";
      return e;
    }
    FileTooLargeError.prototype = Object.create(Error.prototype);
    FileTooLargeError.prototype.constructor = FileTooLargeError;
    Object.defineProperty(FileTooLargeError, "name", { value: "FileTooLargeError" });
    return FileTooLargeError;
  })();

  const InvalidPdfMagicBytesError = (() => {
    function InvalidPdfMagicBytesError(this: Error) {
      const e = new Error("Invalid PDF magic bytes");
      Object.setPrototypeOf(e, InvalidPdfMagicBytesError.prototype);
      e.name = "InvalidPdfMagicBytesError";
      return e;
    }
    InvalidPdfMagicBytesError.prototype = Object.create(Error.prototype);
    InvalidPdfMagicBytesError.prototype.constructor = InvalidPdfMagicBytesError;
    Object.defineProperty(InvalidPdfMagicBytesError, "name", { value: "InvalidPdfMagicBytesError" });
    return InvalidPdfMagicBytesError;
  })();

  const R2UploadError = (() => {
    function R2UploadError(this: Error, msg: string | Error) {
      const e = new Error(typeof msg === "string" ? msg : msg.message);
      Object.setPrototypeOf(e, R2UploadError.prototype);
      e.name = "R2UploadError";
      return e;
    }
    R2UploadError.prototype = Object.create(Error.prototype);
    R2UploadError.prototype.constructor = R2UploadError;
    Object.defineProperty(R2UploadError, "name", { value: "R2UploadError" });
    return R2UploadError;
  })();
  return {
    deletePdfFromR2: vi.fn(),
    uploadPdfToR2: vi.fn(),
    buildReportKey: vi.fn(),
    assertPdfSize: vi.fn(),
    isPdfMagicBytes: vi.fn(),
    R2DeleteError,
    FileTooLargeError,
    InvalidPdfMagicBytesError,
    R2UploadError,
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createReport,
  updateReport,
  listReports,
  markReportIssuedAction,
  deleteReportAction,
  uploadAndCreateReportAction,
} from "../reports";
import {
  deletePdfFromR2,
  uploadPdfToR2,
  buildReportKey,
  assertPdfSize,
  isPdfMagicBytes,
  R2DeleteError,
  FileTooLargeError,
  R2UploadError,
} from "@/lib/storage/r2";
import { reportService } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

class InvalidFilePathError extends Error {
  override name = "InvalidFilePathError";
}

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateReport = vi.mocked(reportService.createReport);
const mockedUpdateReport = vi.mocked(reportService.updateReport);
const mockedListAllReports = vi.mocked(reportService.listAllReports);
const mockedMarkReportIssued = vi.mocked(reportService.markReportIssued);
const mockedDeleteReport = vi.mocked(reportService.deleteReport);
const mockedGetReportById = vi.mocked(reportService.getReportById);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedDeletePdfFromR2 = vi.mocked(deletePdfFromR2);
const mockedUploadPdfToR2 = vi.mocked(uploadPdfToR2);
const mockedBuildReportKey = vi.mocked(buildReportKey);
const mockedAssertPdfSize = vi.mocked(assertPdfSize);
const mockedIsPdfMagicBytes = vi.mocked(isPdfMagicBytes);

const fakeAdmin = { id: "u1", role: "admin" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

const fakeReport = {
  id: "r1",
  clientId: "00000000-0000-0000-0000-000000000001",
  projectId: null,
  title: "Rapport Livraison",
  kind: "delivery" as const,
  summary: null,
  filePath: "reports/2026/r1.pdf",
  issuedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ownerId: "u1",
};

describe("createReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  it("rejects non-admin user", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("Unauthorized"));
    const result = await createReport({
      clientId: "00000000-0000-0000-0000-000000000001",
      title: "Test",
      filePath: "reports/test.pdf",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid input (empty title)", async () => {
    const result = await createReport({
      clientId: "00000000-0000-0000-0000-000000000001",
      title: "",
      filePath: "reports/test.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid input (filePath empty)", async () => {
    const result = await createReport({
      clientId: "00000000-0000-0000-0000-000000000001",
      title: "Test",
      filePath: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid input (clientId not UUID)", async () => {
    const result = await createReport({
      clientId: "not-a-uuid",
      title: "Test",
      filePath: "reports/test.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts valid input with projectId", async () => {
    mockedCreateReport.mockResolvedValue(fakeReport);
    const result = await createReport({
      clientId: "00000000-0000-0000-0000-000000000001",
      projectId: "00000000-0000-0000-0000-000000000002",
      title: "Rapport Livraison",
      filePath: "reports/2026/r1.pdf",
    });
    expect(result.ok).toBe(true);
    expect(mockedCreateReport).toHaveBeenCalled();
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("accepts valid input without projectId (null)", async () => {
    mockedCreateReport.mockResolvedValue(fakeReport);
    const result = await createReport({
      clientId: "00000000-0000-0000-0000-000000000001",
      title: "Rapport Livraison",
      filePath: "reports/2026/r1.pdf",
    });
    expect(result.ok).toBe(true);
    expect(mockedCreateReport).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: null }),
    );
  });

  it("maps InvalidFilePathError to REPORT_INVALID_PATH", async () => {
    mockedCreateReport.mockRejectedValue(new InvalidFilePathError());
    const result = await createReport({
      clientId: "00000000-0000-0000-0000-000000000001",
      title: "Rapport",
      filePath: "reports/test.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("REPORT_INVALID_PATH");
  });
});

describe("updateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  it("rejects non-admin user", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("Unauthorized"));
    const result = await updateReport("r1", { title: "New Title" });
    expect(result.ok).toBe(false);
  });

  it("rejects empty patch (refine error)", async () => {
    const result = await updateReport("r1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid patch (title empty string after trim)", async () => {
    const result = await updateReport("r1", { title: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts valid title update", async () => {
    mockedUpdateReport.mockResolvedValue({ ...fakeReport, title: "Updated" });
    const result = await updateReport("r1", { title: "Updated" });
    expect(result.ok).toBe(true);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("accepts kind update", async () => {
    mockedUpdateReport.mockResolvedValue({ ...fakeReport, kind: "audit" });
    const result = await updateReport("r1", { kind: "audit" });
    expect(result.ok).toBe(true);
  });

  it("accepts projectId update to null (clearing project)", async () => {
    mockedUpdateReport.mockResolvedValue({ ...fakeReport, projectId: null });
    const result = await updateReport("r1", { projectId: null });
    expect(result.ok).toBe(true);
    expect(mockedUpdateReport).toHaveBeenCalledWith("r1", expect.objectContaining({ projectId: null }));
  });
});

describe("listReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  const makeReports = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...fakeReport, id: `r${i + 1}` }));

  it("rejects non-admin user", async () => {
    mockedRequireAdmin.mockRejectedValue(new Error("Unauthorized"));
    const result = await listReports();
    expect(result.ok).toBe(false);
  });

  it("lists all reports with default pagination", async () => {
    const reports = makeReports(5);
    mockedListAllReports.mockResolvedValue(reports);
    const result = await listReports();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(5);
      expect(result.data.total).toBe(5);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("lists filtered by kind", async () => {
    mockedListAllReports.mockResolvedValue([]);
    await listReports({ kind: "audit", page: 1, pageSize: 20, status: "all" });
    expect(mockedListAllReports).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "audit" }),
    );
  });

  it("lists filtered by undatedOnly", async () => {
    mockedListAllReports.mockResolvedValue([]);
    await listReports({ undatedOnly: true, page: 1, pageSize: 20, status: "all" });
    expect(mockedListAllReports).toHaveBeenCalledWith(
      expect.objectContaining({ undatedOnly: true }),
    );
  });

  it("paginates correctly (page 2, pageSize 5, 12 items)", async () => {
    const reports = makeReports(12);
    mockedListAllReports.mockResolvedValue(reports);
    const result = await listReports({ page: 2, pageSize: 5, status: "all" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(5);
      expect(result.data.total).toBe(12);
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(5);
    }
  });
});

describe("markReportIssuedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  it("T19: marks draft as issued", async () => {
    const issued = { ...fakeReport, issuedAt: new Date() };
    mockedMarkReportIssued.mockResolvedValue(issued);
    const result = await markReportIssuedAction("r1");
    expect(result.ok).toBe(true);
    expect(mockedMarkReportIssued).toHaveBeenCalledWith("r1", undefined);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/reports");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/reports/r1");
  });

  it("T20: passes explicit issuedAt to service", async () => {
    const explicitDate = new Date("2026-01-15T00:00:00Z");
    const issued = { ...fakeReport, issuedAt: explicitDate };
    mockedMarkReportIssued.mockResolvedValue(issued);
    const result = await markReportIssuedAction("r1", { issuedAt: explicitDate });
    expect(result.ok).toBe(true);
    expect(mockedMarkReportIssued).toHaveBeenCalledWith("r1", explicitDate);
  });

  it("T21: idempotent when already issued", async () => {
    const alreadyIssued = { ...fakeReport, issuedAt: new Date("2026-01-01") };
    mockedMarkReportIssued.mockResolvedValue(alreadyIssued);
    const result = await markReportIssuedAction("r1");
    expect(result.ok).toBe(true);
  });

  it("T22: service returns null → INTERNAL_ERROR", async () => {
    mockedMarkReportIssued.mockResolvedValue(null);
    const result = await markReportIssuedAction("r1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("T23: invalid date string → VALIDATION_ERROR", async () => {
    const result = await markReportIssuedAction("r1", {
      issuedAt: "not-a-date" as unknown as Date,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("T24: non-admin → redirect propagated", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as unknown as Record<string, unknown>).digest = "NEXT_REDIRECT;/login";
    mockedRequireAdmin.mockRejectedValue(redirectError);
    await expect(markReportIssuedAction("r1")).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("deleteReportAction", () => {
  const deleteId = "00000000-0000-0000-0000-000000000010";
  const deleteReport = { ...fakeReport, id: deleteId };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  it("T25: deletes draft + R2 cleanup", async () => {
    mockedGetReportById.mockResolvedValue(deleteReport);
    mockedDeleteReport.mockResolvedValue({ deletedReport: deleteReport });
    mockedDeletePdfFromR2.mockResolvedValue(undefined);
    const result = await deleteReportAction(deleteId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.deleted).toBe(true);
      expect(result.data.fileCleanupAttempted).toBe(true);
    }
    expect(mockedDeletePdfFromR2).toHaveBeenCalledWith("reports/2026/r1.pdf");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("T26: guard issued → 409", async () => {
    const issuedReport = { ...deleteReport, issuedAt: new Date() };
    mockedGetReportById.mockResolvedValue(issuedReport);
    const result = await deleteReportAction(deleteId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REPORT_DELETE_LOCKED");
      expect(result.error.status).toBe(409);
    }
    expect(mockedDeleteReport).not.toHaveBeenCalled();
  });

  it("T27: not found → 404", async () => {
    mockedGetReportById.mockResolvedValue(null);
    const result = await deleteReportAction("00000000-0000-0000-0000-000000000099");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REPORT_NOT_FOUND");
      expect(result.error.status).toBe(404);
    }
  });

  it("T28: R2 fails → best-effort ok", async () => {
    mockedGetReportById.mockResolvedValue(deleteReport);
    mockedDeleteReport.mockResolvedValue({ deletedReport: deleteReport });
    mockedDeletePdfFromR2.mockRejectedValue(new R2DeleteError(new Error("R2 failure")));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deleteReportAction(deleteId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.deleted).toBe(true);
      expect(result.data.fileCleanupAttempted).toBe(false);
    }
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("uploadAndCreateReportAction", () => {
  const VALID_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
  const FAKE_KEY = "reports/2026/05/fake-uuid.pdf";

  function makeFormData(overrides: Partial<{ file: File | null; clientId: string; title: string; kind: string; projectId: string; summary: string }> = {}): FormData {
    const fd = new FormData();
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(100).fill(0)]);
    const file = overrides.file !== undefined ? overrides.file : new File([pdfBuffer], "test.pdf", { type: "application/pdf" });
    if (file) fd.append("file", file);
    fd.append("clientId", overrides.clientId ?? VALID_CLIENT_ID);
    fd.append("title", overrides.title ?? "Mon rapport");
    fd.append("kind", overrides.kind ?? "delivery");
    if (overrides.projectId) fd.append("projectId", overrides.projectId);
    if (overrides.summary) fd.append("summary", overrides.summary);
    return fd;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
    mockedBuildReportKey.mockReturnValue(FAKE_KEY);
    mockedIsPdfMagicBytes.mockReturnValue(true);
    mockedAssertPdfSize.mockImplementation(() => {});
    mockedUploadPdfToR2.mockResolvedValue(undefined);
    mockedCreateReport.mockResolvedValue({ ...fakeReport, filePath: FAKE_KEY });
  });

  it("T29: happy path — uploads and creates report", async () => {
    const result = await uploadAndCreateReportAction(makeFormData());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.filePath).toBe(FAKE_KEY);
    expect(mockedUploadPdfToR2).toHaveBeenCalledWith(FAKE_KEY, expect.any(Buffer));
    expect(mockedCreateReport).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: VALID_CLIENT_ID, title: "Mon rapport", kind: "delivery", filePath: FAKE_KEY }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/reports");
  });

  it("T30: file missing → FILE_REQUIRED", async () => {
    const fd = new FormData();
    fd.append("clientId", VALID_CLIENT_ID);
    fd.append("title", "Test");
    fd.append("kind", "delivery");
    const result = await uploadAndCreateReportAction(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FILE_REQUIRED");
      expect(result.error.status).toBe(400);
    }
    expect(mockedUploadPdfToR2).not.toHaveBeenCalled();
  });

  it("T31: file empty (size 0) → FILE_REQUIRED", async () => {
    const emptyFile = new File([], "empty.pdf", { type: "application/pdf" });
    const result = await uploadAndCreateReportAction(makeFormData({ file: emptyFile }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FILE_REQUIRED");
  });

  it("T32: file too large → FILE_TOO_LARGE", async () => {
    mockedAssertPdfSize.mockImplementation(() => { throw new (FileTooLargeError as unknown as new () => Error)(); });
    const result = await uploadAndCreateReportAction(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FILE_TOO_LARGE");
      expect(result.error.status).toBe(400);
    }
    expect(mockedUploadPdfToR2).not.toHaveBeenCalled();
  });

  it("T33: invalid magic bytes → INVALID_PDF", async () => {
    mockedIsPdfMagicBytes.mockReturnValue(false);
    const result = await uploadAndCreateReportAction(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PDF");
      expect(result.error.status).toBe(400);
    }
    expect(mockedUploadPdfToR2).not.toHaveBeenCalled();
  });

  it("T34: metadata validation fail → VALIDATION_ERROR", async () => {
    const result = await uploadAndCreateReportAction(makeFormData({ clientId: "not-a-uuid" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("T35: R2 upload fails → R2_UPLOAD_FAILED", async () => {
    mockedUploadPdfToR2.mockRejectedValue(new (R2UploadError as unknown as new (msg: string) => Error)("upload failed"));
    const result = await uploadAndCreateReportAction(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("R2_UPLOAD_FAILED");
      expect(result.error.status).toBe(500);
    }
    expect(mockedCreateReport).not.toHaveBeenCalled();
  });

  it("T36: createReport fails + rollback with console.error", async () => {
    mockedCreateReport.mockRejectedValue(new Error("DB error"));
    mockedDeletePdfFromR2.mockRejectedValue(new Error("R2 cleanup error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await uploadAndCreateReportAction(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(mockedDeletePdfFromR2).toHaveBeenCalledWith(FAKE_KEY);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[uploadAndCreateReportAction] rollback R2 cleanup failed",
      FAKE_KEY,
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
