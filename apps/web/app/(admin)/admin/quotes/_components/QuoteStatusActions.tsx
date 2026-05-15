"use client";

import React, { useTransition } from "react";
import { transitionQuoteStatusAction } from "@/app/actions/quotes";
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
import type { QuoteStatus } from "@/lib/schemas/quote.schemas";

interface TransitionButton {
  label: string;
  targetStatus: QuoteStatus;
  variant: "default" | "destructive" | "secondary";
}

const TRANSITION_BUTTONS: Record<QuoteStatus, TransitionButton[]> = {
  draft: [
    { label: "Envoyer le devis", targetStatus: "sent", variant: "default" },
  ],
  sent: [
    { label: "Marquer accepté", targetStatus: "accepted", variant: "default" },
    { label: "Marquer refusé", targetStatus: "declined", variant: "destructive" },
    { label: "Marquer expiré", targetStatus: "expired", variant: "secondary" },
  ],
  accepted: [],
  declined: [],
  expired: [],
};

interface QuoteStatusActionsProps {
  quoteId: string;
  quoteNumber: string;
  currentStatus: QuoteStatus;
}

export function QuoteStatusActions({
  quoteId,
  quoteNumber,
  currentStatus,
}: QuoteStatusActionsProps) {
  const [isPending, startTransition] = useTransition();
  const buttons = TRANSITION_BUTTONS[currentStatus];

  if (buttons.length === 0) {
    return <p>Aucune action possible (état terminal).</p>;
  }

  function handleConfirm(targetStatus: QuoteStatus) {
    startTransition(async () => {
      const result = await transitionQuoteStatusAction(quoteId, { targetStatus });
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
              data-testid={`transition-${btn.targetStatus}-trigger`}
            >
              {btn.label}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer l&apos;action</AlertDialogTitle>
              <AlertDialogDescription>
                {btn.label} — {quoteNumber} ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleConfirm(btn.targetStatus)}
                data-testid={`transition-${btn.targetStatus}-confirm`}
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
