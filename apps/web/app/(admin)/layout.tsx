import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@saas/services";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
          <span className="text-sm text-muted-foreground">
            Connecté en tant qu&apos;admin —{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </span>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
