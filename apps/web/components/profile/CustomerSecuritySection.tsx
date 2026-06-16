import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getUserTotpStatus } from "@saas/services";
import { Badge } from "@/components/ui/badge";
import { CustomerChangePasswordButton } from "@/components/profile/CustomerChangePasswordButton";

export async function CustomerSecuritySection({ userId }: { userId: string }) {
  const { totpEnabled } = await getUserTotpStatus(userId);

  return (
    <div className="rounded-2xl border bg-card p-5 lg:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ShieldCheck size={16} className="text-muted-foreground" />
        </div>
        <h4 className="text-lg font-semibold text-foreground">Sécurité</h4>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Authentification à deux facteurs</span>
          <Badge variant={totpEnabled ? "default" : "secondary"}>
            {totpEnabled ? "Activé" : "Non activé"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totpEnabled ? (
            <Link
              href="/account/security"
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Désactiver le 2FA
            </Link>
          ) : (
            <Link
              href="/account/security/setup"
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Configurer le 2FA
            </Link>
          )}
          <CustomerChangePasswordButton />
        </div>
      </div>
    </div>
  );
}
