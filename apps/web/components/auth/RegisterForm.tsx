"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "../../app/actions/auth";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <>
      {state && "error" in state && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nom (optionnel)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Jean Dupont"
          />
        </div>

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
            autoComplete="new-password"
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Au moins 8 caractères</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {pending ? "Création du compte…" : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-500">
        En créant un compte, vous acceptez nos{" "}
        <Link href="/terms" className="text-blue-600 hover:text-blue-500">CGU</Link>{" "}
        et notre{" "}
        <Link href="/privacy" className="text-blue-600 hover:text-blue-500">
          politique de confidentialité
        </Link>
        .
      </p>

      <p className="mt-6 text-center text-sm text-gray-500">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
          Se connecter
        </Link>
      </p>
    </>
  );
}
