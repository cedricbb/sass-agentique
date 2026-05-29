import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
vi.mock("@/lib/auth", () => ({ requireCustomer: vi.fn() }));

import { GET } from "../route";
import { reportService } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { requireCustomer } from "@/lib/auth";

const mockGetReportById = reportService.getReportById as ReturnType<typeof vi.fn>;
const mockStreamPdf = streamPdfFromR2 as ReturnType<typeof vi.fn>;
const mockRequireCustomer = requireCustomer as ReturnType<typeof vi.fn>;

const CUSTOMER_CLIENT_ID = "client-abc";

function makeRequest() {
  return new NextRequest("http://localhost/api/account/reports/test-id/file");
}

function makeParams(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id",
    filePath: "reports/test.pdf",
    issuedAt: new Date("2024-01-01"),
    clientId: CUSTOMER_CLIENT_ID,
    ...overrides,
  };
}

describe("GET /api/account/reports/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCustomer.mockResolvedValue({
      user: { id: "user-1" },
      client: { id: CUSTOMER_CLIENT_ID },
    });
  });

  it("returns 200 with PDF stream and correct headers when all guards pass", async () => {
    mockGetReportById.mockResolvedValue(makeReport());
    const body = new ReadableStream();
    mockStreamPdf.mockResolvedValue({ body, contentLength: 4567, contentType: "application/pdf" });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="report-test-id.pdf"');
    expect(response.headers.get("Content-Length")).toBe("4567");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when report not found", async () => {
    mockGetReportById.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns 404 when report exists but not issued", async () => {
    mockGetReportById.mockResolvedValue(makeReport({ issuedAt: null }));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns 404 when report belongs to another client", async () => {
    mockGetReportById.mockResolvedValue(makeReport({ clientId: "other-client-id" }));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns identical 404 body for not-found, not-issued, and wrong-client", async () => {
    mockGetReportById.mockResolvedValue(null);
    const r1 = await GET(makeRequest(), makeParams());
    const body1 = await r1.text();

    mockGetReportById.mockResolvedValue(makeReport({ issuedAt: null }));
    const r2 = await GET(makeRequest(), makeParams());
    const body2 = await r2.text();

    mockGetReportById.mockResolvedValue(makeReport({ clientId: "other-client-id" }));
    const r3 = await GET(makeRequest(), makeParams());
    const body3 = await r3.text();

    expect(body1).toBe("Not Found");
    expect(body2).toBe(body1);
    expect(body3).toBe(body1);
  });

  it("returns 404 when R2NotFoundError thrown", async () => {
    mockGetReportById.mockResolvedValue(makeReport());
    mockStreamPdf.mockRejectedValue(new R2NotFoundError("reports/test.pdf"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("File not found");
  });

  it("returns 500 and logs on generic R2 error", async () => {
    mockGetReportById.mockResolvedValue(makeReport());
    const genericError = new Error("connection reset");
    mockStreamPdf.mockRejectedValue(genericError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[GET /api/account/reports/[id]/file] R2 stream error",
      genericError,
    );
    consoleSpy.mockRestore();
  });

  it("propagates NEXT_REDIRECT when not authenticated", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login;307",
    });
    mockRequireCustomer.mockRejectedValue(redirectError);

    await expect(GET(makeRequest(), makeParams())).rejects.toThrow("NEXT_REDIRECT");
  });
});
