import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@saas/services", () => ({
  getInvoiceByIdForOwner: vi.fn(),
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
vi.mock("@/lib/pdf/generate-invoice-pdf", () => ({
  generateAndStoreInvoicePdf: vi.fn(),
}));

import { GET } from "../route";
import { getInvoiceByIdForOwner } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { requireAdmin } from "@/lib/auth";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";

const mockGetInvoiceByIdForOwner = getInvoiceByIdForOwner as ReturnType<
  typeof vi.fn
>;
const mockStreamPdf = streamPdfFromR2 as ReturnType<typeof vi.fn>;
const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;
const mockGeneratePdf = generateAndStoreInvoicePdf as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest("http://localhost/api/invoices/test-id/file");
}

function makeParams(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/invoices/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("route GET calls getInvoiceByIdForOwner with session owner id", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: "invoices/x.pdf",
      number: "F-001",
      issuedAt: new Date(),
    });
    mockStreamPdf.mockResolvedValue({ body: new ReadableStream(), contentLength: 10 });

    await GET(makeRequest(), makeParams());

    expect(mockGetInvoiceByIdForOwner).toHaveBeenCalledWith("test-id", "admin-1");
  });

  it("returns 200 with PDF stream and correct headers", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: "invoices/x.pdf",
      number: "F-001",
      issuedAt: new Date(),
    });
    const body = new ReadableStream();
    mockStreamPdf.mockResolvedValue({ body, contentLength: 5000 });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="facture-F-001.pdf"',
    );
    expect(response.headers.get("Content-Length")).toBe("5000");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 404 when invoice not found", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("triggers lazy regen when pdfKey null and issuedAt set", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: null,
      number: "F-002",
      issuedAt: new Date(),
    });
    mockGeneratePdf.mockResolvedValue({ pdfKey: "invoices/regen.pdf" });
    const body = new ReadableStream();
    mockStreamPdf.mockResolvedValue({ body, contentLength: 3000 });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(mockGeneratePdf).toHaveBeenCalledWith("test-id");
    expect(mockStreamPdf).toHaveBeenCalledWith("invoices/regen.pdf");
  });

  it("returns 404 when pdfKey null and issuedAt null", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: null,
      number: "F-003",
      issuedAt: null,
    });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(mockGeneratePdf).not.toHaveBeenCalled();
  });

  it("returns 404 when R2NotFoundError thrown", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: "invoices/x.pdf",
      number: "F-001",
      issuedAt: new Date(),
    });
    mockStreamPdf.mockRejectedValue(new R2NotFoundError("invoices/x.pdf"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });

  it("returns 500 and logs on generic R2 error", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: "invoices/x.pdf",
      number: "F-001",
      issuedAt: new Date(),
    });
    const genericError = new Error("connection reset");
    mockStreamPdf.mockRejectedValue(genericError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[GET /api/invoices/[id]/file] R2 stream error",
      genericError,
    );
    consoleSpy.mockRestore();
  });

  it("propagates NEXT_REDIRECT when not admin", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login;307",
    });
    mockRequireAdmin.mockRejectedValue(redirectError);

    await expect(GET(makeRequest(), makeParams())).rejects.toThrow("NEXT_REDIRECT");
  });

  it("returns 404 when lazy regen throws", async () => {
    mockGetInvoiceByIdForOwner.mockResolvedValue({
      id: "test-id",
      pdfKey: null,
      number: "F-004",
      issuedAt: new Date(),
    });
    mockGeneratePdf.mockRejectedValue(new Error("BusinessProfileRequiredError"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });
});
