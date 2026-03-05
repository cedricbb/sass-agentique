"use client";

import { useState } from "react";
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

interface UserActionsProps {
  userId: string;
  isBanned: boolean;
  totpEnabled: boolean;
}

type ConfirmAction = "ban" | "unban" | "resetTotp" | null;

export function UserActions({ userId, isBanned, totpEnabled }: UserActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  const confirmMessages: Record<
    NonNullable<ConfirmAction>,
    { title: string; description: string }
  > = {
    ban: {
      title: "Bannir cet utilisateur ?",
      description:
        "L'utilisateur ne pourra plus se connecter. Cette action est réversible.",
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

  async function handleConfirm() {
    if (!confirm) return;
    setPending(true);
    try {
      if (confirm === "ban") await banUserAction(userId);
      if (confirm === "unban") await unbanUserAction(userId);
      if (confirm === "resetTotp") await resetUserTotpAction(userId);
      router.refresh();
    } finally {
      setPending(false);
      setConfirm(null);
    }
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
            <AlertDialogAction onClick={handleConfirm} disabled={pending}>
              {pending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
