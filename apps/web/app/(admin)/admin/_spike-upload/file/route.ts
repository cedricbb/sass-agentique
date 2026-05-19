import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { streamPdfFromR2, R2NotFoundError } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await requireAdmin();

  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key parameter required" }, { status: 400 });
  }

  try {
    const { body, contentLength, contentType } = await streamPdfFromR2(key);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    if (err instanceof R2NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
