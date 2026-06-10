"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  recordPaymentFormSchema,
  type RecordPaymentFormValues,
} from "@/lib/schemas/payment.schemas";
import { createPaymentAction } from "@/app/actions/payments";
import { toastResult, toast } from "@/lib/toast";

const PAYMENT_METHOD_LABELS = {
  stripe_card: "Carte bancaire",
  bank_transfer: "Virement",
  other: "Autre",
} as const;

interface RecordPaymentDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  remainingTtcCents: number;
}

export function RecordPaymentDialog({
  invoiceId,
  invoiceNumber,
  remainingTtcCents,
}: RecordPaymentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentFormSchema),
    defaultValues: {
      amountCents: remainingTtcCents,
      method: "bank_transfer",
      paidAt: new Date(),
      externalRef: null,
      notes: null,
    },
  });

  async function onSubmit(values: RecordPaymentFormValues) {
    const result = await createPaymentAction({
      ...values,
      invoiceId,
      amountCents: Math.round(parseFloat(String(values.amountCents / 100)) * 100),
    });

    if (!result.ok) {
      if (result.error.code === "PAYMENT_OVERPAYMENT") {
        toast.error("Le montant excède le solde dû");
        return;
      }
      if (result.error.code === "PAYMENT_INVOICE_NOT_OPEN") {
        toast.error(
          "Le statut de la facture ne permet pas l'enregistrement d'un paiement",
        );
        return;
      }
      toastResult(result, "");
      return;
    }

    toastResult(result, "Paiement enregistré");
    setIsOpen(false);
    reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="record-payment-button">
          Enregistrer un paiement
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="record-payment-dialog">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement — {invoiceNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="rp-amount">Montant (€)</Label>
            <Input
              id="rp-amount"
              type="number"
              step="0.01"
              data-testid="record-payment-amount-input"
              defaultValue={remainingTtcCents / 100}
              onChange={(e) => {
                const cents = Math.round(parseFloat(e.target.value) * 100);
                setValue("amountCents", isNaN(cents) ? 0 : cents);
              }}
            />
            {errors.amountCents && (
              <p className="text-sm text-destructive">{errors.amountCents.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Méthode de paiement</Label>
            <Select
              defaultValue="bank_transfer"
              onValueChange={(val) =>
                setValue("method", val as RecordPaymentFormValues["method"])
              }
            >
              <SelectTrigger data-testid="record-payment-method-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} data-testid={`record-payment-method-${value}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="rp-paidat">Date de paiement</Label>
            <Input
              id="rp-paidat"
              type="date"
              data-testid="record-payment-paidat-input"
              defaultValue={new Date().toISOString().slice(0, 10)}
              {...register("paidAt")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="rp-externalref">Référence externe</Label>
            <Input
              id="rp-externalref"
              type="text"
              data-testid="record-payment-externalref-input"
              placeholder="Référence externe (chèque n°, virement…)"
              {...register("externalRef")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="rp-notes">Notes</Label>
            <Textarea
              id="rp-notes"
              data-testid="record-payment-notes-input"
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="record-payment-cancel"
              onClick={() => setIsOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="record-payment-submit"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
