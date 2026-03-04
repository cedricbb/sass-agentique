"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [state, action, isPending] = useActionState(registerAction, null);

  return (
    <div className="space-y-6">
      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nom <span className="text-gray-400 text-xs font-normal">(optionnel)</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Jean Dupont"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@exemple.com"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mot de passe <span className="text-red-500">*</span>
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            className="h-11"
          />
          <p className="text-xs text-gray-400">Au moins 8 caractères</p>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
        >
          {isPending ? "Création du compte…" : "Créer mon compte"}
        </Button>
      </form>

      <div className="space-y-3 text-center">
        <p className="text-xs text-gray-400">
          En créant un compte, vous acceptez nos{" "}
          <Link href="/terms" className="text-amber-600 hover:text-amber-700 dark:text-amber-500">CGU</Link>{" "}
          et notre{" "}
          <Link href="/privacy" className="text-amber-600 hover:text-amber-700 dark:text-amber-500">
            politique de confidentialité
          </Link>
          .
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-amber-600 hover:text-amber-700 dark:text-amber-500 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
