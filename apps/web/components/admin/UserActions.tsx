"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { banUserAction, unbanUserAction, resetUserTotpAction } from "@/app/actions/admin";
import { toastResult } from "@/lib/toast";

interface UserActionsProps {
  userId: string;
  isBanned: boolean;
  totpEnabled: boolean;
}

type ConfirmAction = "ban" | "unban" | "resetTotp" | null;

const confirmMessages: Record<NonNullable<ConfirmAction>, { title: string; description: string }> =
  {
    ban: {
      title: "Bannir cet utilisateur ?",
      description: "L'utilisateur ne pourra plus se connecter. Cette action est réversible.",
    },
    unban: {
      title: "Débannir cet utilisateur ?",
      description: "L'utilisateur pourra à nouveau se connecter.",
    },
    resetTotp: {
      title: "Réinitialiser le 2FA ?",
      description:
        "Le secret TOTP et les codes de backup seront supprimés. L'utilisateur devra reconfigurer son 2FA.",
    },
  };

const successMessages: Record<NonNullable<ConfirmAction>, string> = {
  ban: "Utilisateur banni",
  unban: "Utilisateur débanni",
  resetTotp: "2FA réinitialisé",
};

export function UserActions({ userId, isBanned, totpEnabled }: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  function handleConfirm() {
    if (!confirm) return;
    const action = confirm;
    startTransition(async () => {
      let result;
      if (action === "ban") result = await banUserAction(userId);
      else if (action === "unban") result = await unbanUserAction(userId);
      else result = await resetUserTotpAction(userId);
      if (toastResult(result, successMessages[action])) {
        setConfirm(null);
        router.refresh();
      }else result = await resetUserTotpAction(userId);
      console.log("[R9-6 debug] result:", result);                                    // ← AJOUT
      console.log("[R9-6 debug] message:", successMessages[action]);                  // ← AJOUT
      if (toastResult(result, successMessages[action])) {
        setConfirm(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isBanned ? (
            <DropdownMenuItem onClick={() => setConfirm("unban")}>
              <ShieldOff className="mr-2 size-3.5" />
              Débannir
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setConfirm("ban")}
              className="text-red-600 focus:text-red-600"
            >
              <Shield className="mr-2 size-3.5" />
              Bannir
            </DropdownMenuItem>
          )}
          {totpEnabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirm("resetTotp")}>
                <KeyRound className="mr-2 size-3.5" />
                Reset 2FA
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm ? confirmMessages[confirm].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? confirmMessages[confirm].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
