"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addInvoiceItemSchema, updateInvoiceItemSchema, type InvoiceItemAddValues } from "@/lib/schemas/invoice-item.schemas";
import { addInvoiceItemAction, updateInvoiceItemAction } from "@/app/actions/invoice-items";
import { toastResult } from "@/lib/toast";
import type { InvoiceItem } from "@saas/db";
import type { Prestation } from "@saas/db";

interface EditInvoiceItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: InvoiceItem;
  invoiceId: string;
  prestations: Prestation[];
}

export function EditInvoiceItemDialog({
  open,
  onOpenChange,
  initialData,
  invoiceId,
  prestations,
}: EditInvoiceItemDialogProps) {
  const isEdit = !!initialData;
  const [mode, setMode] = useState<"libre" | "prestation">("libre");

  const schema = isEdit ? updateInvoiceItemSchema : addInvoiceItemSchema;

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceItemAddValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: initialData
      ? {
          description: initialData.description,
          quantity: initialData.quantity,
          unitPriceEurCents: initialData.unitPriceEurCents,
          sortOrder: initialData.sortOrder,
        }
      : { quantity: 1, unitPriceEurCents: 0 },
  });

  function handlePrestationChange(prestationId: string) {
    const p = prestations.find((pr) => pr.id === prestationId);
    if (!p) return;
    setValue("description", p.name);
    setValue("unitPriceEurCents", p.basePriceEurCents);
  }

  async function onSubmit(values: InvoiceItemAddValues) {
    const payload = {
      ...values,
      unitPriceEurCents: Math.round(values.unitPriceEurCents),
    };
    const result = isEdit
      ? await updateInvoiceItemAction(initialData!.id, payload)
      : await addInvoiceItemAction(invoiceId, payload);
    const ok = toastResult(result, isEdit ? "Ligne modifiée" : "Ligne ajoutée");
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
              <Select onValueChange={handlePrestationChange}>
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
            <Button type="submit" disabled={isSubmitting} data-testid="invoice-item-submit-button">
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
