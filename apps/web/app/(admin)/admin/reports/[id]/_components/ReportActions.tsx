"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle, Trash2 } from "lucide-react";
import {
  markReportIssuedAction,
  deleteReportAction,
} from "@/app/actions/reports";
import { toastResult, toast } from "@/lib/toast";

interface ReportActionsProps {
  reportId: string;
  isIssued: boolean;
}

export function ReportActions({ reportId, isIssued }: ReportActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleMarkIssued() {
    startTransition(async () => {
      const result = await markReportIssuedAction(reportId);
      if (toastResult(result, "Rapport marqué comme émis.")) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteReportAction(reportId);
      if (result.ok) {
        toast.success("Rapport supprimé.");
        router.push("/admin/reports");
      } else if (result.error.code === "REPORT_DELETE_LOCKED") {
        toast.error("Un rapport émis ne peut pas être supprimé.");
      } else {
        toast.error("Une erreur est survenue lors de la suppression.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {!isIssued && (
        <Button
          onClick={handleMarkIssued}
          disabled={isPending}
          data-testid="report-mark-issued-button"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Marquer comme émis
        </Button>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isPending || isIssued}
                    data-testid="report-delete-trigger"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Supprimer ce rapport ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le fichier PDF associé sera
                      également supprimé du stockage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="report-delete-cancel">
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="report-delete-confirm"
                      disabled={isPending}
                      onClick={handleDelete}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </span>
          </TooltipTrigger>
          {isIssued && (
            <TooltipContent>
              Un rapport émis ne peut pas être supprimé.
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
