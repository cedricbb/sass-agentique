"use client";

import { useActionState } from "react";
import { disableTotpAction } from "../../app/actions/totp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DisableTotpForm() {
  const [state, action, isPending] = useActionState(disableTotpAction, null);

  if (state && "success" in state) {
    return (
      <Alert className="border-green-500 text-green-700 [&>svg]:text-green-600">
        <AlertDescription>2FA désactivé avec succès.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="disable-code">
          Code TOTP ou code de secours pour confirmer
        </Label>
        <Input
          id="disable-code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
          placeholder="Code de vérification"
        />
      </div>

      <Button
        type="submit"
        variant="destructive"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Désactivation…" : "Désactiver le 2FA"}
      </Button>
    </form>
  );
}
