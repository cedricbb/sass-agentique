"use client";

import React, { useTransition } from "react";
import { transitionInvoiceStatusAction } from "@/app/actions/invoices";
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
import type { InvoiceStatus } from "@/lib/schemas/invoice.schemas";

interface TransitionButton {
  label: string;
  targetStatus: InvoiceStatus;
  variant: "default" | "destructive" | "secondary";
}

const TRANSITION_BUTTONS: Record<InvoiceStatus, TransitionButton[]> = {
  draft: [
    { label: "Envoyer la facture", targetStatus: "sent", variant: "default" },
    { label: "Annuler la facture", targetStatus: "cancelled", variant: "destructive" },
  ],
  sent: [
    { label: "Marquer payée", targetStatus: "paid", variant: "default" },
    { label: "Marquer en retard", targetStatus: "overdue", variant: "secondary" },
    { label: "Annuler la facture", targetStatus: "cancelled", variant: "destructive" },
  ],
  overdue: [
    { label: "Marquer payée", targetStatus: "paid", variant: "default" },
    { label: "Annuler la facture", targetStatus: "cancelled", variant: "destructive" },
  ],
  paid: [],
  cancelled: [],
};

interface InvoiceStatusActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  currentStatus: InvoiceStatus;
}

export function InvoiceStatusActions({
  invoiceId,
  invoiceNumber,
  currentStatus,
}: InvoiceStatusActionsProps) {
  const [isPending, startTransition] = useTransition();
  const buttons = TRANSITION_BUTTONS[currentStatus];

  if (buttons.length === 0) {
    return <p>Aucune action possible (état terminal).</p>;
  }

  function handleConfirm(targetStatus: InvoiceStatus) {
    startTransition(async () => {
      const result = await transitionInvoiceStatusAction(invoiceId, { targetStatus });
      toastResult(result, "Statut mis à jour");
    });
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {buttons.map((btn) => (
        <AlertDialog key={btn.targetStatus}>
          <AlertDialogTrigger asChild>
            <Button
              variant={btn.variant}
              disabled={isPending}
              data-testid={`invoice-transition-${btn.targetStatus}-trigger`}
            >
              {btn.label}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer l&apos;action</AlertDialogTitle>
              <AlertDialogDescription>
                {btn.label} — {invoiceNumber} ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleConfirm(btn.targetStatus)}
                data-testid={`invoice-transition-${btn.targetStatus}-confirm`}
              >
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  );
}
