"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { addClientContactAction } from "@/app/actions/clients";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREDEFINED_ROLES = ["Décideur", "Comptable", "Chef de projet", "Technique", "Autre"] as const;

interface AddClientContactDialogProps {
  clientId: string;
}

export function AddClientContactDialog({ clientId }: AddClientContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [customRole, setCustomRole] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const resolvedRole = (): string | null => {
    if (!selectedRole) return null;
    if (selectedRole === "Autre") return customRole.trim() || null;
    return selectedRole;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string).trim();
    const email = (formData.get("email") as string).trim();

    startTransition(async () => {
      const result = await addClientContactAction({
        clientId,
        name,
        email,
        role: resolvedRole(),
        isPrimary,
      });
      toastResult(result, "Contact ajouté");
      if (result.ok) {
        setOpen(false);
        setSelectedRole(undefined);
        setCustomRole("");
        setIsPrimary(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Ajouter un contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="contact-name">Nom</Label>
            <Input id="contact-name" name="name" required minLength={1} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" name="email" type="email" required />
          </div>
          <div className="space-y-1">
            <Label>Rôle</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un rôle (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole === "Autre" && (
              <Input
                placeholder="Précisez le rôle"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="contact-is-primary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked === true)}
            />
            <Label htmlFor="contact-is-primary">Contact principal</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "En cours…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
