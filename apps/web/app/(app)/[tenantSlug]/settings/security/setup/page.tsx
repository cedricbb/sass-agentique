import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, generateTotpSecret } from "@saas/services";
import { TotpSetupForm } from "../../../../../../components/auth/TotpSetupForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function TotpSetupPage({ params: _params }: Props) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const { secret, qrDataUrl } = await generateTotpSecret(user.email);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Configurer le 2FA</CardTitle>
            <CardDescription>
              Scannez ce QR code avec votre application d&apos;authentification
              (Google Authenticator, Authy…), puis entrez le code pour confirmer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TotpSetupForm secret={secret} qrDataUrl={qrDataUrl} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
