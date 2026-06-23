"use client";

import * as React from "react";
import { useTransition } from "react";
import { deleteClientContactAction } from "@/app/actions/clients";
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
import { Trash2 } from "lucide-react";

interface DeleteClientContactButtonProps {
  contactId: string;
  clientId: string;
  contactName: string;
  hasPortalAccess: boolean;
}

export function DeleteClientContactButton({
  contactId,
  clientId,
  contactName,
  hasPortalAccess,
}: DeleteClientContactButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteClientContactAction(contactId, clientId);
      toastResult(result, "Contact supprimé");
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Supprimer le contact" disabled={isPending}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {contactName} ?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasPortalAccess
              ? "Ce contact a un accès portail actif. La suppression révoquera cet accès. Cette action est irréversible."
              : "Ce contact sera définitivement supprimé. Cette action est irréversible."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
