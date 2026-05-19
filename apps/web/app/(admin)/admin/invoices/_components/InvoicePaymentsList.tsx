"use client";

import { useTransition } from "react";
import type { Payment } from "@saas/db";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { deletePaymentAction } from "@/app/actions/payments";
import { toast } from "@/lib/toast";
import { formatDate, formatCurrency } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-labels";

interface InvoicePaymentsListProps {
  invoiceId: string;
  invoiceStatus: string;
  payments: Payment[] | undefined | null;
}

export function InvoicePaymentsList({ invoiceId, invoiceStatus, payments }: InvoicePaymentsListProps) {
  const [isPending, startTransition] = useTransition();
  const list = payments ?? [];

  async function handleDelete(paymentId: string) {
    startTransition(async () => {
      const result = await deletePaymentAction(paymentId, invoiceId);
      if (result.ok) {
        toast.success("Paiement supprimé");
      } else if (result.error.code === "PAYMENT_LOCKED_BY_INVOICE") {
        toast.error("Impossible de supprimer ce paiement : la facture est désormais payée.");
      } else {
        toast.error("Une erreur est survenue lors de la suppression.");
      }
    });
  }

  return (
    <Card data-testid="invoice-payments-list">
      <CardHeader>
        <CardTitle>Paiements enregistrés</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p data-testid="invoice-payments-empty" className="text-center text-muted-foreground">
            Aucun paiement enregistré
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((payment) => (
              <div
                key={payment.id}
                data-testid={`invoice-payment-item-${payment.id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span>{formatDate(payment.paidAt)}</span>
                <span>{paymentMethodLabel(payment.method)}</span>
                <span>{formatCurrency(payment.amountEurCents / 100)}</span>
                {payment.externalRef && (
                  <span className="text-muted-foreground truncate max-w-[120px]">{payment.externalRef}</span>
                )}
                {invoiceStatus !== "paid" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`invoice-payment-delete-trigger-${payment.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le paiement de {formatCurrency(payment.amountEurCents / 100)} du{" "}
                          {formatDate(payment.paidAt)} sera supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="invoice-payment-delete-cancel">Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          data-testid={`invoice-payment-delete-confirm-${payment.id}`}
                          disabled={isPending}
                          onClick={() => handleDelete(payment.id)}
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
