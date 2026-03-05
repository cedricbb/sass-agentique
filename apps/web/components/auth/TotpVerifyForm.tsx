"use client";

import { useActionState, useState } from "react";
import { totpVerifyAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/ui/otp-input";

type Props = {
  next?: string;
};

export function TotpVerifyForm({ next }: Props) {
  const [state, action, isPending] = useActionState(totpVerifyAction, null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  return (
    <>
      {state && "error" in state && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-6">
        {next && <input type="hidden" name="next" value={next} />}

        {useBackupCode ? (
          <div className="space-y-1.5">
            <Label htmlFor="code">Code de secours</Label>
            <Input
              id="code"
              name="code"
              type="text"
              required
              autoComplete="off"
              maxLength={10}
              pattern="[0-9a-f]{10}"
              className="tracking-widest text-center font-mono"
              placeholder="xxxxxxxxxx"
              autoFocus
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Entrez le code à 6 chiffres de votre application
            </p>
            <OtpInput name="code" length={6} autoFocus />
          </div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Vérification…" : "Vérifier"}
        </Button>
      </form>

      <Button
        type="button"
        variant="link"
        onClick={() => setUseBackupCode((v) => !v)}
        className="mt-2 w-full"
      >
        {useBackupCode
          ? "Utiliser un code TOTP"
          : "Utiliser un code de secours"}
      </Button>
    </>
  );
}
