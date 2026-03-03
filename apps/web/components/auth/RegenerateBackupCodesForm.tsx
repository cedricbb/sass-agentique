"use client";

import { useActionState } from "react";
import { regenerateBackupCodesAction } from "../../app/actions/totp";

export function RegenerateBackupCodesForm() {
  const [state, action, pending] = useActionState(regenerateBackupCodesAction, null);

  const backupCodes =
    state && "success" in state && state.backupCodes ? state.backupCodes : null;

  return (
    <div className="space-y-3">
      {backupCodes && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            Nouveaux codes générés. Sauvegardez-les maintenant, ils ne seront plus affichés.
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <ul className="grid grid-cols-2 gap-1">
              {backupCodes.map((code) => (
                <li
                  key={code}
                  className="font-mono text-sm text-gray-800 bg-white border border-gray-200 rounded px-2 py-1 text-center"
                >
                  {code}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {state && "error" in state && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-medium rounded-lg text-sm transition-colors border border-gray-300"
        >
          {pending ? "Génération…" : "Régénérer les codes de secours"}
        </button>
      </form>
    </div>
  );
}
