"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/lib/schemas/project.schemas";
import { transitionStatusAction } from "@/app/actions/projects";
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
} from "@/components/ui/alert-dialog";

interface TransitionButton {
  label: string;
  newStatus: ProjectStatus;
  variant: "default" | "secondary" | "destructive";
  confirm: boolean;
}

const TRANSITION_BUTTONS: Record<ProjectStatus, TransitionButton[]> = {
  draft: [
    { label: "Démarrer", newStatus: "active", variant: "default", confirm: false },
    { label: "Annuler", newStatus: "cancelled", variant: "destructive", confirm: true },
  ],
  active: [
    { label: "Mettre en pause", newStatus: "on_hold", variant: "secondary", confirm: false },
    { label: "Marquer livré", newStatus: "delivered", variant: "default", confirm: true },
    { label: "Annuler", newStatus: "cancelled", variant: "destructive", confirm: true },
  ],
  on_hold: [
    { label: "Reprendre", newStatus: "active", variant: "default", confirm: false },
    { label: "Annuler", newStatus: "cancelled", variant: "destructive", confirm: true },
  ],
  delivered: [],
  cancelled: [],
};

interface ProjectStatusActionsProps {
  projectId: string;
  projectName: string;
  currentStatus: ProjectStatus;
}

export function ProjectStatusActions({ projectId, projectName, currentStatus }: ProjectStatusActionsProps) {
  const router = useRouter();
  const [openConfirm, setOpenConfirm] = useState<ProjectStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const buttons = TRANSITION_BUTTONS[currentStatus] ?? [];

  const executeTransition = (newStatus: ProjectStatus) => {
    startTransition(async () => {
      const result = await transitionStatusAction(projectId, newStatus);
      setOpenConfirm(null);
      if (toastResult(result, "Statut mis à jour")) {
        router.push("/admin/projects");
      }
    });
  };

  if (buttons.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune action possible (état terminal).</p>;
  }

  return (
    <div className="flex gap-2">
      {buttons.map((btn) =>
        btn.confirm ? (
          <React.Fragment key={btn.newStatus}>
            <Button
              variant={btn.variant}
              disabled={isPending}
              data-testid={`transition-${btn.newStatus}-trigger`}
              onClick={() => setOpenConfirm(btn.newStatus)}
            >
              {btn.label}
            </Button>
            <AlertDialog open={openConfirm === btn.newStatus} onOpenChange={(open) => !open && setOpenConfirm(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la transition</AlertDialogTitle>
                  <AlertDialogDescription>
                    Voulez-vous vraiment passer le projet « {projectName} » en statut « {btn.newStatus} » ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    data-testid={`transition-${btn.newStatus}-confirm`}
                    onClick={() => executeTransition(btn.newStatus)}
                  >
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </React.Fragment>
        ) : (
          <Button
            key={btn.newStatus}
            variant={btn.variant}
            disabled={isPending}
            data-testid={`transition-${btn.newStatus}-trigger`}
            onClick={() => executeTransition(btn.newStatus)}
          >
            {btn.label}
          </Button>
        )
      )}
    </div>
  );
}
