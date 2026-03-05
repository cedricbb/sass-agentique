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
import { updateSocialLinksAction } from "@/app/actions/profile";

interface SocialLinksEditButtonProps {
  initialLinks: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  } | null;
}

export function SocialLinksEditButton({ initialLinks }: SocialLinksEditButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateSocialLinksAction, null);
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
            <DialogTitle>Modifier les réseaux sociaux</DialogTitle>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="github" className="text-sm font-medium text-foreground">
                GitHub
              </label>
              <Input
                id="github"
                name="github"
                defaultValue={initialLinks?.github ?? ""}
                placeholder="https://github.com/..."
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="linkedin" className="text-sm font-medium text-foreground">
                LinkedIn
              </label>
              <Input
                id="linkedin"
                name="linkedin"
                defaultValue={initialLinks?.linkedin ?? ""}
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="twitter" className="text-sm font-medium text-foreground">
                Twitter / X
              </label>
              <Input
                id="twitter"
                name="twitter"
                defaultValue={initialLinks?.twitter ?? ""}
                placeholder="https://x.com/..."
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="instagram" className="text-sm font-medium text-foreground">
                Instagram
              </label>
              <Input
                id="instagram"
                name="instagram"
                defaultValue={initialLinks?.instagram ?? ""}
                placeholder="https://instagram.com/..."
              />
            </div>

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
