"use client";

import { useActionState } from "react";
import { resendVerificationEmailAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ActionState = { error: string } | { success: true } | null;

export function EmailVerificationBanner({ emailVerified }: { emailVerified: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    resendVerificationEmailAction as (state: ActionState, formData: FormData) => Promise<ActionState>,
    null,
  );

  if (emailVerified) return null;

  return (
    <Alert
      className="rounded-none border-x-0 border-t-0 border-amber-400 bg-amber-50 text-amber-800 [&>svg]:text-amber-600"
    >
      <AlertDescription>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span>
            Votre adresse email n&apos;est pas encore vérifiée. Certaines
            fonctionnalités sont limitées.
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {"success" in (state ?? {}) ? (
              <span className="text-sm font-medium">Email envoyé ✓</span>
            ) : (
              <form action={formAction}>
                <Button
                  type="submit"
                  variant="link"
                  disabled={isPending}
                  className="h-auto p-0 text-amber-900 font-medium"
                >
                  {isPending ? "Envoi…" : "Renvoyer l'email"}
                </Button>
              </form>
            )}
            {"error" in (state ?? {}) && (
              <span className="text-sm text-destructive">
                {"error" in (state as { error: string })
                  ? (state as { error: string }).error
                  : ""}
              </span>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
