"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus } from "lucide-react";
import { removeQuoteItemAction } from "@/app/actions/quote-items";
import { toastResult } from "@/lib/toast";
import { EditQuoteItemDialog } from "./EditQuoteItemDialog";
import type { QuoteItem } from "@saas/db";
import type { Prestation } from "@saas/db";

interface QuoteItemsEditorProps {
  quoteId: string;
  items: QuoteItem[];
  prestations: Prestation[];
  canEdit: boolean;
}

function formatEur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function QuoteItemsEditor({ quoteId, items, prestations, canEdit }: QuoteItemsEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<QuoteItem | undefined>(undefined);
  const [removing, setRemoving] = useState<string | null>(null);

  function openAdd() {
    setEditItem(undefined);
    setDialogOpen(true);
  }

  function openEdit(item: QuoteItem) {
    setEditItem(item);
    setDialogOpen(true);
  }

  async function handleRemove(itemId: string) {
    setRemoving(itemId);
    const result = await removeQuoteItemAction(itemId, quoteId);
    toastResult(result, "Ligne supprimée");
    setRemoving(null);
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <Badge variant="secondary" data-testid="quote-items-locked-badge">
          Verrouillé (devis émis)
        </Badge>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">Prix unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {canEdit && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground">
                Aucune ligne
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.description}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">{formatEur(item.unitPriceEurCents)}</TableCell>
              <TableCell className="text-right">{formatEur(item.quantity * item.unitPriceEurCents)}</TableCell>
              {canEdit && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(item)}
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(item.id)}
                      disabled={removing === item.id}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canEdit && (
        <Button variant="outline" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ligne
        </Button>
      )}

      <EditQuoteItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editItem}
        quoteId={quoteId}
        prestations={prestations}
      />
    </div>
  );
}
