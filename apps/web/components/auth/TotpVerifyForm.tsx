"use client";

import { useActionState, useState } from "react";
import { totpVerifyAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

      <form action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        <div className="space-y-1.5">
          <Label htmlFor="code">
            {useBackupCode ? "Code de secours" : "Code à 6 chiffres"}
          </Label>
          <Input
            id="code"
            name="code"
            type="text"
            required
            autoComplete="one-time-code"
            inputMode={useBackupCode ? "text" : "numeric"}
            maxLength={useBackupCode ? 10 : 6}
            pattern={useBackupCode ? "[0-9a-f]{10}" : "[0-9]{6}"}
            className="tracking-widest text-center"
            placeholder={useBackupCode ? "xxxxxxxxxx" : "123456"}
          />
        </div>

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
