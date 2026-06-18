import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getQuoteById } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";
import { generateAndStoreQuotePdf } from "@/lib/pdf/generate-quote-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireAdmin();
  const { id } = await params;

  const quote = await getQuoteById(id);
  if (!quote) {
    return new Response("Not Found", { status: 404 });
  }

  let key: string;

  if (quote.pdfKey != null) {
    key = quote.pdfKey;
  } else if (quote.issuedAt == null) {
    return new Response("Not Found", { status: 404 });
  } else {
    try {
      const result = await generateAndStoreQuotePdf(id);
      key = result.pdfKey;
    } catch (err) {
      console.error("[GET /api/quotes/[id]/file] lazy regen error", err);
      return new Response("Not Found", { status: 404 });
    }
  }

  try {
    const { body, contentLength } = await streamPdfFromR2(key);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="devis-${quote.number}.pdf"`,
        "Content-Length": String(contentLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof R2NotFoundError) {
      return new Response("File not found", { status: 404 });
    }
    console.error("[GET /api/quotes/[id]/file] R2 stream error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
