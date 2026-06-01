"use client";

import * as React from "react";
import { useTransition } from "react";
import { inviteCustomerAction } from "@/app/actions/clients";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InviteCustomerDialogProps {
  clientId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  hasActiveInvitation: boolean;
  activeExpiresAt?: Date;
}

export function InviteCustomerDialog({
  clientId,
  contactId,
  contactName,
  contactEmail,
  hasActiveInvitation,
}: InviteCustomerDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleInvite = () => {
    startTransition(async () => {
      const result = await inviteCustomerAction(clientId, contactId);
      toastResult(result, "Invitation envoyée");
    });
  };

  const triggerLabel = hasActiveInvitation ? "Renvoyer l'invitation" : "Inviter au portail";
  const dialogTitle = hasActiveInvitation
    ? `Renvoyer l'invitation à ${contactName} ?`
    : `Inviter ${contactName} au portail client ?`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            Un email sera envoyé à <strong>{contactEmail}</strong> avec un lien valable 24h.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleInvite} disabled={isPending}>
            Envoyer l&apos;invitation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
