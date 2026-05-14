"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { archivePrestationAction } from "@/app/actions/prestations";
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

interface ArchivePrestationButtonProps {
  id: string;
  prestationName: string;
}

export function ArchivePrestationButton({
  id,
  prestationName,
}: ArchivePrestationButtonProps): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(): void {
    startTransition(async () => {
      const result = await archivePrestationAction(id);
      if (toastResult(result, "Prestation archivée")) {
        setOpen(false);
        router.push("/admin/prestations");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          data-testid="archive-prestation-trigger"
        >
          <Archive className="mr-2 h-4 w-4" />
          Archiver
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archiver la prestation « {prestationName} » ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action archive la prestation : elle ne sera plus
            visible dans le catalogue, mais reste accessible aux
            contrats existants qui la référencent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            data-testid="archive-prestation-confirm"
          >
            {isPending ? "Archivage..." : "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
