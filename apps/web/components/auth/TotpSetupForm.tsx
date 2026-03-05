"use client";

import { useActionState } from "react";
import { confirmTotpSetupAction } from "../../app/actions/totp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";

type Props = {
  secret: string;
  qrDataUrl: string;
};

export function TotpSetupForm({ secret, qrDataUrl }: Props) {
  const [state, action, isPending] = useActionState(confirmTotpSetupAction, null);

  const backupCodes =
    state && "success" in state && state.backupCodes ? state.backupCodes : null;

  if (backupCodes) {
    return (
      <div className="space-y-4">
        <Alert className="border-green-500 text-green-700 [&>svg]:text-green-600">
          <AlertTitle>2FA activé avec succès !</AlertTitle>
          <AlertDescription>
            Conservez ces codes de secours dans un endroit sûr. Ils ne seront
            affichés qu&apos;une seule fois.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground mb-3">
            Codes de secours
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {backupCodes.map((code) => (
              <li
                key={code}
                className="font-mono text-sm bg-background border rounded px-2 py-1 text-center"
              >
                {code}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="QR code 2FA"
          className="w-48 h-48 rounded-lg border"
        />
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground mb-1">
          Ou entrez ce code manuellement :
        </p>
        <p className="font-mono text-sm break-all select-all">{secret}</p>
      </div>

      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="secret" value={secret} />

        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Entrez le code affiché dans votre application
          </p>
          <OtpInput name="code" length={6} autoFocus />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Activation…" : "Activer le 2FA"}
        </Button>
      </form>
    </div>
  );
}
