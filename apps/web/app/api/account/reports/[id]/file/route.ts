import { NextRequest } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { reportService } from "@saas/services";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const scope = await requireCustomer();
  const { id } = await params;

  const report = await reportService.getReportById(id);
  if (!report) {
    return new Response("Not Found", { status: 404 });
  }

  if (!report.issuedAt) {
    return new Response("Not Found", { status: 404 });
  }

  if (report.clientId !== scope.client.id) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const { body, contentLength } = await streamPdfFromR2(report.filePath);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${id}.pdf"`,
        "Content-Length": String(contentLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof R2NotFoundError) {
      return new Response("File not found", { status: 404 });
    }
    console.error("[GET /api/account/reports/[id]/file] R2 stream error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
