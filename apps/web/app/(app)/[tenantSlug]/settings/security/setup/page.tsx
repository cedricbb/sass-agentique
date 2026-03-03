import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, generateTotpSecret } from "@saas/services";
import { TotpSetupForm } from "../../../../../../components/auth/TotpSetupForm";

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
    <div className="max-w-lg mx-auto mt-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Configurer le 2FA
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Scannez ce QR code avec votre application d&apos;authentification (Google
        Authenticator, Authy…), puis entrez le code pour confirmer.
      </p>
      <TotpSetupForm secret={secret} qrDataUrl={qrDataUrl} />
    </div>
  );
}
