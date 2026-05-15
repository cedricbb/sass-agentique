"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addQuoteItemSchema, updateQuoteItemSchema, type QuoteItemAddValues } from "@/lib/schemas/quote-item.schemas";
import { addQuoteItemAction, updateQuoteItemAction } from "@/app/actions/quote-items";
import { toastResult } from "@/lib/toast";
import type { QuoteItem } from "@saas/db";
import type { Prestation } from "@saas/db";

interface EditQuoteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: QuoteItem;
  quoteId: string;
  prestations: Prestation[];
}

export function EditQuoteItemDialog({
  open,
  onOpenChange,
  initialData,
  quoteId,
  prestations,
}: EditQuoteItemDialogProps) {
  const isEdit = !!initialData;
  const [mode, setMode] = useState<"libre" | "prestation">(
    isEdit && initialData?.prestationId ? "prestation" : "libre"
  );

  const schema = isEdit ? updateQuoteItemSchema : addQuoteItemSchema;

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<QuoteItemAddValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? {
          description: initialData.description,
          quantity: initialData.quantity,
          unitPriceEurCents: initialData.unitPriceEurCents,
          prestationId: initialData.prestationId ?? undefined,
          sortOrder: initialData.sortOrder,
        }
      : { quantity: 1, unitPriceEurCents: 0 },
  });

  function handlePrestationChange(prestationId: string) {
    const p = prestations.find((pr) => pr.id === prestationId);
    if (!p) return;
    setValue("prestationId", prestationId);
    setValue("description", p.name);
    setValue("unitPriceEurCents", p.unitPriceEurCents ?? 0);
  }

  async function onSubmit(values: QuoteItemAddValues) {
    const payload = {
      ...values,
      unitPriceEurCents: Math.round(values.unitPriceEurCents),
    };
    const result = isEdit
      ? await updateQuoteItemAction(initialData!.id, payload)
      : await addQuoteItemAction(quoteId, payload);
    const ok = toastResult(result);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la ligne" : "Ajouter une ligne"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "libre" ? "default" : "outline"}
              onClick={() => setMode("libre")}
            >
              Libre
            </Button>
            <Button
              type="button"
              variant={mode === "prestation" ? "default" : "outline"}
              onClick={() => setMode("prestation")}
            >
              Prestation
            </Button>
          </div>

          {mode === "prestation" && (
            <div className="space-y-1">
              <Label>Prestation</Label>
              <Select
                defaultValue={initialData?.prestationId ?? undefined}
                onValueChange={handlePrestationChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une prestation" />
                </SelectTrigger>
                <SelectContent>
                  {prestations.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantité</Label>
              <Input
                id="quantity"
                type="number"
                {...register("quantity", { valueAsNumber: true })}
              />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="unitPrice">Prix unitaire (€)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                defaultValue={initialData ? initialData.unitPriceEurCents / 100 : 0}
                onChange={(e) => {
                  const cents = Math.round(parseFloat(e.target.value) * 100);
                  setValue("unitPriceEurCents", isNaN(cents) ? 0 : cents);
                }}
              />
              {errors.unitPriceEurCents && <p className="text-sm text-destructive">{errors.unitPriceEurCents.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="quote-item-submit-button">
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
