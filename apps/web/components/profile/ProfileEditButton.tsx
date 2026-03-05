"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
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
import { updateProfileAction } from "@/app/actions/profile";

interface ProfileEditButtonProps {
  initialName: string | null;
  initialBio?: string | null;
  initialLocation?: string | null;
  initialWebsite?: string | null;
}

export function ProfileEditButton({
  initialName,
  initialBio,
  initialLocation,
  initialWebsite,
}: ProfileEditButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateProfileAction, null);
  const wasSubmitted = useRef(false);

  useEffect(() => {
    if (pending) {
      wasSubmitted.current = true;
    }
    if (wasSubmitted.current && !pending && state === null) {
      setOpen(false);
      wasSubmitted.current = false;
    }
  }, [state, pending]);

  const showExtended = initialBio !== undefined;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Pencil className="size-3.5" />
        Modifier
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Nom complet
              </label>
              <Input
                id="name"
                name="name"
                defaultValue={initialName ?? ""}
                placeholder="Votre nom"
                autoFocus
              />
            </div>

            {showExtended && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="bio" className="text-sm font-medium text-foreground">
                    Bio
                  </label>
                  <Input
                    id="bio"
                    name="bio"
                    defaultValue={initialBio ?? ""}
                    placeholder="Courte description"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="location" className="text-sm font-medium text-foreground">
                    Localisation
                  </label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={initialLocation ?? ""}
                    placeholder="Ville, Pays"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="website" className="text-sm font-medium text-foreground">
                    Site web
                  </label>
                  <Input
                    id="website"
                    name="website"
                    defaultValue={initialWebsite ?? ""}
                    placeholder="https://..."
                  />
                </div>
              </>
            )}

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
