"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(forgotPasswordAction, null);

  if (state && "success" in state) {
    return (
      <div className="space-y-4">
        <Alert className="border-green-500 text-green-700 [&>svg]:text-green-600">
          <AlertDescription>
            <p className="font-semibold mb-1">Email envoyé !</p>
            <p>
              Si cette adresse email existe, vous recevrez un lien de
              réinitialisation sous peu.
            </p>
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <Link href="/login" className="text-primary hover:underline text-sm">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {state && "error" in state && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={action} className="space-y-4">
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

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Envoi…" : "Envoyer le lien"}
        </Button>
      </form>

      <CardFooter className="flex justify-center px-0 pt-4">
        <Link href="/login" className="text-primary hover:underline text-sm">
          Retour à la connexion
        </Link>
      </CardFooter>
    </>
  );
}
