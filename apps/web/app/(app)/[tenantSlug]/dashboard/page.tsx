import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { validateSession } from "@saas/services";
import { logoutAction } from "../../../actions/auth";
import { TenantInfo } from "../../../../components/tenant/TenantInfo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;

  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-sm">SaaS Agentique</span>
            <nav className="flex items-center gap-1">
              <Link
                href={`/${tenantSlug}/dashboard`}
                className="text-foreground font-medium text-sm px-3 py-1.5 rounded-md bg-muted"
              >
                Dashboard
              </Link>
              <Link
                href={`/${tenantSlug}/members`}
                className="text-muted-foreground hover:text-foreground text-sm px-3 py-1.5 rounded-md hover:bg-muted/50"
              >
                Membres
              </Link>
              <Link
                href={`/${tenantSlug}/settings/security`}
                className="text-muted-foreground hover:text-foreground text-sm px-3 py-1.5 rounded-md hover:bg-muted/50"
              >
                Sécurité
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Separator orientation="vertical" className="h-4" />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </main>
    </div>
  );
}
