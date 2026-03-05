import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, getAgentTaskLogs } from "@saas/services";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await validateSession(sessionToken);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { taskId } = await params;
  const logs = await getAgentTaskLogs(taskId);

  return NextResponse.json({ logs });
}
