"use client";

import React, { useState } from "react";
import { acceptCustomerQuoteAction, declineCustomerQuoteAction } from "@/app/actions/customer-quotes";
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
import type { CustomerVisibleQuoteStatus } from "@saas/services/quote.shared";

interface QuoteCustomerActionsProps {
  quoteId: string;
  quoteNumber: string;
  status: CustomerVisibleQuoteStatus;
}

export function QuoteCustomerActions({
  quoteId,
  quoteNumber,
  status,
}: QuoteCustomerActionsProps) {
  const [isPending, setIsPending] = useState(false);

  if (status !== "sent") return null;

  async function handleAccept() {
    setIsPending(true);
    const result = await acceptCustomerQuoteAction(quoteId);
    toastResult(result, "Devis accepté");
    setIsPending(false);
  }

  async function handleDecline() {
    setIsPending(true);
    const result = await declineCustomerQuoteAction(quoteId);
    toastResult(result, "Devis refusé");
    setIsPending(false);
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="default"
            disabled={isPending}
            data-testid="quote-accept-trigger"
          >
            Accepter le devis
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accepter le devis</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmer l&apos;acceptation du devis {quoteNumber} ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAccept}
              data-testid="quote-accept-confirm"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            disabled={isPending}
            data-testid="quote-decline-trigger"
          >
            Refuser le devis
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser le devis</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmer le refus du devis {quoteNumber} ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              data-testid="quote-decline-confirm"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
