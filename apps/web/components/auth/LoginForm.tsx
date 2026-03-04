"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  next?: string;
  resetSuccess?: boolean;
};

export function LoginForm({ next, resetSuccess }: Props) {
  const [state, action, isPending] = useActionState(loginAction, null);

  return (
    <div className="space-y-6">
      {resetSuccess && (
        <Alert className="border-green-500 text-green-700 [&>svg]:text-green-600">
          <AlertDescription>
            Mot de passe réinitialisé. Connectez-vous avec vos nouveaux identifiants.
          </AlertDescription>
        </Alert>
      )}

      {state && "error" in state && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-5">
        {next && <input type="hidden" name="next" value={next} />}

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
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mot de passe <span className="text-red-500">*</span>
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-500 font-medium"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-11"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
        >
          {isPending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Pas encore de compte ?{" "}
        <Link href="/register" className="text-amber-600 hover:text-amber-700 dark:text-amber-500 font-medium">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}
