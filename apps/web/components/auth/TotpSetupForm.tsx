"use client";

import { useActionState } from "react";
import { confirmTotpSetupAction } from "../../app/actions/totp";

type Props = {
  secret: string;
  qrDataUrl: string;
};

export function TotpSetupForm({ secret, qrDataUrl }: Props) {
  const [state, action, pending] = useActionState(confirmTotpSetupAction, null);

  const backupCodes =
    state && "success" in state && state.backupCodes ? state.backupCodes : null;

  if (backupCodes) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm font-semibold text-green-800 mb-1">
            2FA activé avec succès !
          </p>
          <p className="text-sm text-green-700">
            Conservez ces codes de secours dans un endroit sûr. Ils ne seront
            affichés qu&apos;une seule fois.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Codes de secours
          </h3>
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR code 2FA" className="w-48 h-48 rounded-lg border border-gray-200" />
      </div>

      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-500 mb-1">Ou entrez ce code manuellement :</p>
        <p className="font-mono text-sm text-gray-800 break-all select-all">{secret}</p>
      </div>

      {state && "error" in state && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="secret" value={secret} />

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
            Code de vérification
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest text-center"
            placeholder="123456"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {pending ? "Activation…" : "Activer le 2FA"}
        </button>
      </form>
    </div>
  );
}
