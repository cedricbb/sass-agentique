"use client";

import { useActionState } from "react";
import { regenerateBackupCodesAction } from "../../app/actions/totp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RegenerateBackupCodesForm() {
  const [state, action, isPending] = useActionState(regenerateBackupCodesAction, null);

  const backupCodes =
    state && "success" in state && state.backupCodes ? state.backupCodes : null;

  return (
    <div className="space-y-3">
      {backupCodes && (
        <div className="space-y-3">
          <Alert className="border-amber-500 text-amber-700 [&>svg]:text-amber-600">
            <AlertDescription>
              Nouveaux codes générés. Sauvegardez-les maintenant, ils ne seront
              plus affichés.
            </AlertDescription>
          </Alert>
          <div className="rounded-lg border bg-muted/40 p-4">
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
      )}

      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action}>
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Génération…" : "Régénérer les codes de secours"}
        </Button>
      </form>
    </div>
  );
}
