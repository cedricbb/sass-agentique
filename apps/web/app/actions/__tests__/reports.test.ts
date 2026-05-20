import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  reportService: {
    createReport: vi.fn(),
    updateReport: vi.fn(),
    listAllReports: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createReport, updateReport, listReports } from "../reports";
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
const mockedRevalidatePath = vi.mocked(revalidatePath);

const fakeAdmin = { id: "u1", role: "admin", tenantId: "t1" } as unknown as Awaited<
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
  tenantId: "t1",
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
    await listReports({ kind: "audit", page: 1, pageSize: 20 });
    expect(mockedListAllReports).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "audit" }),
    );
  });

  it("lists filtered by undatedOnly", async () => {
    mockedListAllReports.mockResolvedValue([]);
    await listReports({ undatedOnly: true, page: 1, pageSize: 20 });
    expect(mockedListAllReports).toHaveBeenCalledWith(
      expect.objectContaining({ undatedOnly: true }),
    );
  });

  it("paginates correctly (page 2, pageSize 5, 12 items)", async () => {
    const reports = makeReports(12);
    mockedListAllReports.mockResolvedValue(reports);
    const result = await listReports({ page: 2, pageSize: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(5);
      expect(result.data.total).toBe(12);
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(5);
    }
  });
});
