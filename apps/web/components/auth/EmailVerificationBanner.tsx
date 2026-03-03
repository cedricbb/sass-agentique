"use client";

import { useActionState } from "react";
import { useTenant } from "../../contexts/TenantContext";
import { resendVerificationEmailAction } from "../../app/actions/auth";

type ActionState = { error: string } | { success: true } | null;

export function EmailVerificationBanner() {
  const { currentUser } = useTenant();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    resendVerificationEmailAction as (state: ActionState, formData: FormData) => Promise<ActionState>,
    null,
  );

  if (currentUser.emailVerified) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-amber-800">
          Votre adresse email n&apos;est pas encore vérifiée. Certaines fonctionnalités sont
          limitées.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {"success" in (state ?? {}) ? (
            <span className="text-sm text-amber-700 font-medium">Email envoyé ✓</span>
          ) : (
            <form action={formAction}>
              <button
                type="submit"
                disabled={isPending}
                className="text-sm font-medium text-amber-900 underline hover:no-underline disabled:opacity-50"
              >
                {isPending ? "Envoi…" : "Renvoyer l'email"}
              </button>
            </form>
          )}
          {"error" in (state ?? {}) && (
            <span className="text-sm text-red-600">
              {"error" in (state as { error: string }) ? (state as { error: string }).error : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
