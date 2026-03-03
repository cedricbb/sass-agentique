"use client";

import { useActionState } from "react";
import { disableTotpAction } from "../../app/actions/totp";

export function DisableTotpForm() {
  const [state, action, pending] = useActionState(disableTotpAction, null);

  if (state && "success" in state) {
    return (
      <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
        2FA désactivé avec succès.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state && "error" in state && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="disable-code" className="block text-sm font-medium text-gray-700 mb-1">
          Code TOTP ou code de secours pour confirmer
        </label>
        <input
          id="disable-code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Code de vérification"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
      >
        {pending ? "Désactivation…" : "Désactiver le 2FA"}
      </button>
    </form>
  );
}
