"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  next?: string;
  resetSuccess?: boolean;
};

export function LoginForm({ next, resetSuccess }: Props) {
  const [state, action, isPending] = useActionState(loginAction, null);

  return (
    <>
      {resetSuccess && (
        <Alert className="mb-4 border-green-500 text-green-700 [&>svg]:text-green-600">
          <AlertDescription>
            Mot de passe réinitialisé. Connectez-vous avec vos nouveaux identifiants.
          </AlertDescription>
        </Alert>
      )}

      {state && "error" in state && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@exemple.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link
              href="/forgot-password"
              className="text-primary hover:underline text-sm"
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
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <CardFooter className="flex justify-center px-0 pt-4">
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-primary hover:underline text-sm font-medium">
            S&apos;inscrire
          </Link>
        </p>
      </CardFooter>
    </>
  );
}
