import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getInvoiceById } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { generateAndStoreInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireAdmin();
  const { id } = await params;

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return new Response("Not Found", { status: 404 });
  }

  let key: string;

  if (invoice.pdfKey != null) {
    key = invoice.pdfKey;
  } else if (invoice.issuedAt == null) {
    return new Response("Not Found", { status: 404 });
  } else {
    try {
      const result = await generateAndStoreInvoicePdf(id);
      key = result.pdfKey;
    } catch (err) {
      console.error("[GET /api/invoices/[id]/file] lazy regen error", err);
      return new Response("Not Found", { status: 404 });
    }
  }

  try {
    const { body, contentLength } = await streamPdfFromR2(key);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${invoice.number}.pdf"`,
        "Content-Length": String(contentLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof R2NotFoundError) {
      return new Response("File not found", { status: 404 });
    }
    console.error("[GET /api/invoices/[id]/file] R2 stream error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
