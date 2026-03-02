"use client";

import { useTransition } from "react";
import { acceptInvitationAction } from "../../app/actions/auth";

export function AcceptInvitationForm({ token }: { token?: string }) {
  const [isPending, startTransition] = useTransition();

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-600 mb-4">Lien d&apos;invitation invalide.</p>
        <a href="/login" className="text-blue-600 hover:underline">
          Retour à la connexion
        </a>
      </div>
    );
  }

  function handleAccept() {
    startTransition(async () => {
      await acceptInvitationAction(token!);
    });
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-gray-600">
        Cliquez sur le bouton ci-dessous pour rejoindre l&apos;espace.
      </p>
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "En cours..." : "Rejoindre l'espace"}
      </button>
      <div className="flex gap-4 justify-center text-sm">
        <a
          href={`/register?token=${token}`}
          className="text-gray-500 hover:text-gray-900"
        >
          Créer un compte
        </a>
        <span className="text-gray-300">|</span>
        <a
          href={`/login?token=${token}`}
          className="text-gray-500 hover:text-gray-900"
        >
          Se connecter
        </a>
      </div>
    </div>
  );
}
