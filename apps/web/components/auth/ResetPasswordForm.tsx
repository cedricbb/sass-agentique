"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { token: string };

export function ResetPasswordForm({ token }: Props) {
  const [state, action, isPending] = useActionState(resetPasswordAction, null);

  return (
    <>
      {state && "error" in state && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">Au moins 8 caractères</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmer le mot de passe</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </>
  );
}
