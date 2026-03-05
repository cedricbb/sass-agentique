import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { validateSession, getUserTotpStatus } from "@saas/services";
import { DisableTotpForm } from "@/components/auth/DisableTotpForm";
import { RegenerateBackupCodesForm } from "@/components/auth/RegenerateBackupCodesForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function SecurityPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const { totpEnabled } = await getUserTotpStatus(user.id);

  return (
    <div className="max-w-lg space-y-6">
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
              <Link href="/account/security/setup">Activer le 2FA</Link>
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
  );
}
