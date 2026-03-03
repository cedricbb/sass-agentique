import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { validateSession, getUserTotpStatus } from "@saas/services";
import { DisableTotpForm } from "../../../../../components/auth/DisableTotpForm";
import { RegenerateBackupCodesForm } from "../../../../../components/auth/RegenerateBackupCodesForm";

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
    <div className="max-w-lg mx-auto mt-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sécurité</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Authentification à deux facteurs
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {totpEnabled
                ? "Le 2FA est activé sur votre compte."
                : "Renforcez la sécurité de votre compte avec un code TOTP."}
            </p>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              totpEnabled
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {totpEnabled ? "Activé" : "Désactivé"}
          </span>
        </div>

        {!totpEnabled && (
          <Link
            href={`/${tenantSlug}/settings/security/setup`}
            className="inline-block w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Activer le 2FA
          </Link>
        )}

        {totpEnabled && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <DisableTotpForm />
            <RegenerateBackupCodesForm />
          </div>
        )}
      </div>
    </div>
  );
}
