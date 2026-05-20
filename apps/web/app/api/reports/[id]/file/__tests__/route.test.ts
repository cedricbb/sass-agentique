import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  reportService: { getReportById: vi.fn() },
}));
vi.mock("@/lib/storage/r2", () => ({
  streamPdfFromR2: vi.fn(),
  R2NotFoundError: class extends Error {
    constructor(k: string) {
      super(k);
      this.name = "R2NotFoundError";
    }
  },
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));

import { GET } from "../route";
import { reportService } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { requireAdmin } from "@/lib/auth";

const mockGetReportById = reportService.getReportById as ReturnType<typeof vi.fn>;
const mockStreamPdf = streamPdfFromR2 as ReturnType<typeof vi.fn>;
const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new Request("http://localhost/api/reports/test-id/file");
}

function makeParams() {
  return { params: Promise.resolve({ id: "test-id" }) };
}

describe("GET /api/reports/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("returns 200 with PDF stream and correct headers", async () => {
    mockGetReportById.mockResolvedValue({
      id: "test-id",
      filePath: "reports/test.pdf",
    });
    const body = new ReadableStream();
    mockStreamPdf.mockResolvedValue({
      body,
      contentLength: 1234,
      contentType: "application/pdf",
    });

    const response = await GET(makeRequest() as any, makeParams());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="report-test-id.pdf"',
    );
    expect(response.headers.get("Content-Length")).toBe("1234");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when report not found", async () => {
    mockGetReportById.mockResolvedValue(null);

    const response = await GET(makeRequest() as any, makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns 404 when R2NotFoundError thrown", async () => {
    mockGetReportById.mockResolvedValue({
      id: "test-id",
      filePath: "reports/test.pdf",
    });
    mockStreamPdf.mockRejectedValue(new R2NotFoundError("reports/test.pdf"));

    const response = await GET(makeRequest() as any, makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("File not found");
  });

  it("returns 500 and logs on generic R2 error", async () => {
    mockGetReportById.mockResolvedValue({
      id: "test-id",
      filePath: "reports/test.pdf",
    });
    const genericError = new Error("connection reset");
    mockStreamPdf.mockRejectedValue(genericError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(makeRequest() as any, makeParams());

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[GET /api/reports/[id]/file] R2 stream error",
      genericError,
    );
    consoleSpy.mockRestore();
  });

  it("propagates NEXT_REDIRECT when not admin", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as any).digest = "NEXT_REDIRECT;/login;307";
    mockRequireAdmin.mockRejectedValue(redirectError);

    await expect(GET(makeRequest() as any, makeParams())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });
});
