"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { resetPasswordAction } from "../../app/actions/auth";
import type { setInitialPasswordAction } from "../../app/actions/auth";

type PasswordFormAction =
  | typeof resetPasswordAction
  | typeof setInitialPasswordAction;

type Props = {
  token: string;
  action: PasswordFormAction;
  submitLabel: string;
  pendingLabel: string;
};

export function PasswordSetupForm({ token, action, submitLabel, pendingLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <>
      {state && "error" in state && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-4">
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
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </form>
    </>
  );
}
