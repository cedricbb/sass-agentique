import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@saas/services", () => ({
  getInvoiceById: vi.fn(),
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
import { getInvoiceById } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { requireCustomer } from "@/lib/auth";

const mockGetInvoiceById = getInvoiceById as ReturnType<typeof vi.fn>;
const mockStreamPdf = streamPdfFromR2 as ReturnType<typeof vi.fn>;
const mockRequireCustomer = requireCustomer as ReturnType<typeof vi.fn>;

const CUSTOMER_CLIENT_ID = "client-1";

function makeRequest() {
  return new NextRequest("http://localhost/api/account/invoices/test-id/file");
}

function makeParams(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id",
    clientId: CUSTOMER_CLIENT_ID,
    status: "sent",
    pdfKey: "invoices/x.pdf",
    number: "F-001",
    ...overrides,
  };
}

describe("GET /api/account/invoices/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCustomer.mockResolvedValue({
      user: { id: "user-1" },
      client: { id: CUSTOMER_CLIENT_ID },
    });
  });

  it("returns_200_with_pdf_stream_and_correct_headers", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice());
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

  it("returns_404_when_invoice_not_found", async () => {
    mockGetInvoiceById.mockResolvedValue(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("returns_404_when_invoice_is_draft", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ status: "draft" }));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });

  it("returns_404_when_client_does_not_own_invoice", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ clientId: "client-OTHER" }));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });

  it("returns_404_when_pdfKey_is_null", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ pdfKey: null }));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });

  it("returns_404_when_r2_not_found_error", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice());
    mockStreamPdf.mockRejectedValue(new R2NotFoundError("invoices/x.pdf"));

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
  });

  it("returns_500_and_logs_on_generic_r2_error", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice());
    const genericError = new Error("connection reset");
    mockStreamPdf.mockRejectedValue(genericError);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[GET /api/account/invoices/[id]/file] R2 stream error",
      genericError,
    );
    consoleSpy.mockRestore();
  });

  it("propagates_next_redirect_when_not_customer", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login;307",
    });
    mockRequireCustomer.mockRejectedValue(redirectError);

    await expect(GET(makeRequest(), makeParams())).rejects.toThrow("NEXT_REDIRECT");
  });
});
