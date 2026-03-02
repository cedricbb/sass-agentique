"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../../app/actions/auth";

type Props = {
  next?: string;
  resetSuccess?: boolean;
};

export function LoginForm({ next, resetSuccess }: Props) {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <>
      {resetSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          Mot de passe réinitialisé. Connectez-vous avec vos nouveaux identifiants.
        </div>
      )}

      {state && "error" in state && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="vous@exemple.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center justify-between">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Pas encore de compte ?{" "}
        <Link href="/register" className="text-blue-600 hover:text-blue-500 font-medium">
          S&apos;inscrire
        </Link>
      </p>
    </>
  );
}
