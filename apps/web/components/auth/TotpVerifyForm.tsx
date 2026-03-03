"use client";

import { useActionState, useState } from "react";
import { totpVerifyAction } from "../../app/actions/auth";

type Props = {
  next?: string;
};

export function TotpVerifyForm({ next }: Props) {
  const [state, action, pending] = useActionState(totpVerifyAction, null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  return (
    <>
      {state && "error" in state && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            {useBackupCode ? "Code de secours" : "Code à 6 chiffres"}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            autoComplete="one-time-code"
            inputMode={useBackupCode ? "text" : "numeric"}
            maxLength={useBackupCode ? 10 : 6}
            pattern={useBackupCode ? "[0-9a-f]{10}" : "[0-9]{6}"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest text-center"
            placeholder={useBackupCode ? "xxxxxxxxxx" : "123456"}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {pending ? "Vérification…" : "Vérifier"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setUseBackupCode((v) => !v)}
        className="mt-4 w-full text-sm text-blue-600 hover:text-blue-500 text-center"
      >
        {useBackupCode
          ? "Utiliser un code TOTP"
          : "Utiliser un code de secours"}
      </button>
    </>
  );
}
