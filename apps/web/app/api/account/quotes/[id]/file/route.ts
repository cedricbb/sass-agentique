import { NextRequest } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { getQuoteById } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const scope = await requireCustomer();
  const { id } = await params;

  const quote = await getQuoteById(id);
  if (!quote) {
    return new Response("Not Found", { status: 404 });
  }

  if (quote.status === "draft") {
    return new Response("Not Found", { status: 404 });
  }

  if (quote.clientId !== scope.client.id) {
    return new Response("Not Found", { status: 404 });
  }

  if (quote.pdfKey == null) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const { body, contentLength } = await streamPdfFromR2(quote.pdfKey);
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
      return new Response("Not Found", { status: 404 });
    }
    console.error("[GET /api/account/quotes/[id]/file] R2 stream error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
