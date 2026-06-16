"use client";

import React, { useActionState, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { changeCustomerPasswordAction } from "@/app/actions/customer-profile";
import { toast } from "@/lib/toast";

export function CustomerChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(changeCustomerPasswordAction, null);
  const wasSubmitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (pending) {
      wasSubmitted.current = true;
    }
    if (wasSubmitted.current && !pending && state === null) {
      setOpen(false);
      formRef.current?.reset();
      toast.success("Mot de passe modifié");
      wasSubmitted.current = false;
    }
  }, [state, pending]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Lock className="size-3.5" />
        Changer le mot de passe
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
          </DialogHeader>

          <form ref={formRef} action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="oldPassword"
                className="text-sm font-medium text-foreground"
              >
                Mot de passe actuel
              </label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                placeholder="••••••••"
                autoFocus
              />
              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="newPassword"
                className="text-sm font-medium text-foreground"
              >
                Nouveau mot de passe
              </label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmNewPassword"
                className="text-sm font-medium text-foreground"
              >
                Confirmer le nouveau mot de passe
              </label>
              <Input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                placeholder="••••••••"
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Modification…" : "Modifier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
