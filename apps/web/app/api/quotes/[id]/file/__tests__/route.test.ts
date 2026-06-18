import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@saas/services", () => ({
  getQuoteById: vi.fn(),
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
vi.mock("@/lib/pdf/generate-quote-pdf", () => ({
  generateAndStoreQuotePdf: vi.fn(),
}));

import { GET } from "../route";
import { getQuoteById } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { requireAdmin } from "@/lib/auth";
import { generateAndStoreQuotePdf } from "@/lib/pdf/generate-quote-pdf";

const mockGetQuoteById = getQuoteById as ReturnType<typeof vi.fn>;
const mockStreamPdf = streamPdfFromR2 as ReturnType<typeof vi.fn>;
const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;
const mockGeneratePdf = generateAndStoreQuotePdf as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest("http://localhost/api/quotes/test-id/file");
}

function makeParams(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/quotes/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("returns_200_with_pdf_stream_and_correct_headers", async () => {
    mockGetQuoteById.mockResolvedValue({
      id: "test-id",
      pdfKey: "quotes/x.pdf",
      number: "DEV-2026-001",
      issuedAt: new Date(),
    });
    const body = new ReadableStream();
    mockStreamPdf.mockResolvedValue({ body, contentLength: 5000 });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="devis-DEV-2026-001.pdf"',
    );
    expect(response.headers.get("Content-Length")).toBe("5000");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns_404_when_quote_not_found", async () => {
    mockGetQuoteById.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("triggers_lazy_regen_when_pdfKey_null_and_issuedAt_set", async () => {
    mockGetQuoteById.mockResolvedValue({
      id: "test-id",
      pdfKey: null,
      number: "DEV-2026-002",
      issuedAt: new Date(),
    });
    mockGeneratePdf.mockResolvedValue({ pdfKey: "quotes/regen.pdf" });
    const body = new ReadableStream();
    mockStreamPdf.mockResolvedValue({ body, contentLength: 3000 });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(mockGeneratePdf).toHaveBeenCalledWith("test-id");
    expect(mockStreamPdf).toHaveBeenCalledWith("quotes/regen.pdf");
  });

  it("returns_404_when_pdfKey_null_and_issuedAt_null", async () => {
    mockGetQuoteById.mockResolvedValue({
      id: "test-id",
      pdfKey: null,
      number: "DEV-2026-003",
      issuedAt: null,
    });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(mockGeneratePdf).not.toHaveBeenCalled();
  });

  it("returns_404_when_R2NotFoundError_thrown", async () => {
    mockGetQuoteById.mockResolvedValue({
      id: "test-id",
      pdfKey: "quotes/x.pdf",
      number: "DEV-2026-001",
      issuedAt: new Date(),
    });
    mockStreamPdf.mockRejectedValue(new R2NotFoundError("quotes/x.pdf"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });

  it("returns_500_and_logs_on_generic_R2_error", async () => {
    mockGetQuoteById.mockResolvedValue({
      id: "test-id",
      pdfKey: "quotes/x.pdf",
      number: "DEV-2026-001",
      issuedAt: new Date(),
    });
    const genericError = new Error("connection reset");
    mockStreamPdf.mockRejectedValue(genericError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[GET /api/quotes/[id]/file] R2 stream error",
      genericError,
    );
    consoleSpy.mockRestore();
  });

  it("propagates_NEXT_REDIRECT_when_not_admin", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login;307",
    });
    mockRequireAdmin.mockRejectedValue(redirectError);

    await expect(GET(makeRequest(), makeParams())).rejects.toThrow("NEXT_REDIRECT");
  });

  it("returns_404_when_lazy_regen_throws", async () => {
    mockGetQuoteById.mockResolvedValue({
      id: "test-id",
      pdfKey: null,
      number: "DEV-2026-004",
      issuedAt: new Date(),
    });
    mockGeneratePdf.mockRejectedValue(new Error("BusinessProfileRequiredError"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });
});
