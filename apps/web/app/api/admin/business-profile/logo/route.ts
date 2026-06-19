import { requireAdmin } from "@/lib/auth";
import { getBusinessProfile } from "@saas/services";
import { fetchImageBytesFromR2, R2NotFoundError } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const user = await requireAdmin();
  const profile = await getBusinessProfile(user.id);

  if (!profile || profile.logoKey == null) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const { buffer, contentType } = await fetchImageBytesFromR2(profile.logoKey);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof R2NotFoundError) {
      return new Response("Not Found", { status: 404 });
    }
    console.error("[GET /api/admin/business-profile/logo] R2 fetch error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
