import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { validateSession, getUserTotpStatus } from "@saas/services";
import { DisableTotpForm } from "../../../../../components/auth/DisableTotpForm";
import { RegenerateBackupCodesForm } from "../../../../../components/auth/RegenerateBackupCodesForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function SecuritySettingsPage({ params }: Props) {
  const { tenantSlug } = await params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const { totpEnabled } = await getUserTotpStatus(user.id);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-sm">SaaS Agentique</span>
            <nav className="flex items-center gap-1">
              <Link
                href={`/${tenantSlug}/dashboard`}
                className="text-muted-foreground hover:text-foreground text-sm px-3 py-1.5 rounded-md hover:bg-muted/50"
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
                className="text-foreground font-medium text-sm px-3 py-1.5 rounded-md bg-muted"
              >
                Sécurité
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-lg space-y-6">
          <h1 className="text-2xl font-bold">Sécurité</h1>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>Authentification à deux facteurs</CardTitle>
                  <CardDescription>
                    {totpEnabled
                      ? "Le 2FA est activé sur votre compte."
                      : "Renforcez la sécurité de votre compte avec un code TOTP."}
                  </CardDescription>
                </div>
                <Badge variant={totpEnabled ? "default" : "secondary"}>
                  {totpEnabled ? "Activé" : "Désactivé"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!totpEnabled && (
                <Button asChild className="w-full">
                  <Link href={`/${tenantSlug}/settings/security/setup`}>
                    Activer le 2FA
                  </Link>
                </Button>
              )}

              {totpEnabled && (
                <div className="space-y-4">
                  <Separator />
                  <DisableTotpForm />
                  <RegenerateBackupCodesForm />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
