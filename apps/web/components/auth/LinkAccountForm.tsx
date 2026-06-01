"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { linkExistingAccountAction } from "../../app/actions/auth";

type Props = {
  token: string;
  action: typeof linkExistingAccountAction;
};

export function LinkAccountForm({ token, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <>
      {state && "error" in state && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Liaison en cours…" : "Lier mon compte existant"}
        </Button>
      </form>
    </>
  );
}