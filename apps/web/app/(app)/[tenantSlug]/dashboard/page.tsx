import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@saas/services";
import { TenantInfo } from "../../../../components/tenant/TenantInfo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Bienvenue{user.name ? `, ${user.name}` : ""} !
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TenantInfo />
        </CardContent>
      </Card>
    </div>
  );
}
