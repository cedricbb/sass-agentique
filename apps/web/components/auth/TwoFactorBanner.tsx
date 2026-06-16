import React from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TwoFactorBanner({ totpEnabled }: { totpEnabled: boolean }) {
  if (totpEnabled) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-amber-400 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
      <AlertDescription>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span>Sécurisez votre compte en activant l&apos;authentification à deux facteurs.</span>
          <Link
            href="/account/security/setup"
            className="shrink-0 text-sm font-medium text-amber-900 underline-offset-4 hover:underline"
          >
            Configurer maintenant
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  );
}
