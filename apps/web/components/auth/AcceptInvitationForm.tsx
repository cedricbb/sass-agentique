"use client";

import { useTransition } from "react";
import { acceptInvitationAction } from "../../app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AcceptInvitationForm({ token }: { token?: string }) {
  const [isPending, startTransition] = useTransition();

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <Alert variant="destructive">
          <AlertDescription>Lien d&apos;invitation invalide.</AlertDescription>
        </Alert>
        <a href="/login" className="text-primary hover:underline text-sm">
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Cliquez sur le bouton ci-dessous pour rejoindre l&apos;espace.
      </p>
      <Button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "En cours..." : "Rejoindre l'espace"}
      </Button>
      <Separator />
      <div className="flex gap-4 justify-center">
        <a
          href={`/register?token=${token}`}
          className="text-primary hover:underline text-sm"
        >
          Créer un compte
        </a>
        <span className="text-muted-foreground">|</span>
        <a
          href={`/login?token=${token}`}
          className="text-primary hover:underline text-sm"
        >
          Se connecter
        </a>
      </div>
    </div>
  );
}
