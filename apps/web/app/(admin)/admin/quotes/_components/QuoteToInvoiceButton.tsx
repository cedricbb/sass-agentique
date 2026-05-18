"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceFromQuoteAction } from "@/app/actions/invoices";
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

interface QuoteToInvoiceButtonProps {
  quoteId: string;
  alreadyInvoiced: boolean;
}

export function QuoteToInvoiceButton({ quoteId, alreadyInvoiced }: QuoteToInvoiceButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (alreadyInvoiced) {
    return (
      <div>
        <Button disabled>Créer une facture</Button>
        <p data-testid="quote-to-invoice-already-invoiced-hint">
          Une facture existe déjà pour ce devis.
        </p>
      </div>
    );
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await createInvoiceFromQuoteAction({ quoteId });
      if (result.ok && result.data?.id) {
        router.push(`/admin/invoices/${result.data.id}`);
      } else if (!result.ok) {
        toastResult(result, "");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} data-testid="quote-to-invoice-button">
          Créer une facture
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Créer une facture</AlertDialogTitle>
          <AlertDialogDescription>
            Confirmer la création de facture depuis ce devis ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            data-testid="quote-to-invoice-confirm"
          >
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
