"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { updateClientContactAction } from "@/app/actions/clients";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pencil } from "lucide-react";

const PREDEFINED_ROLES = [
  "Décideur",
  "Comptable",
  "Chef de projet",
  "Technique",
  "Autre",
] as const;

interface EditClientContactDialogProps {
  contact: { id: string; name: string; email: string; role: string | null };
  clientId: string;
}

function deriveRoleState(role: string | null): {
  selectedRole: string | undefined;
  customRole: string;
} {
  if (role === null) return { selectedRole: undefined, customRole: "" };
  if ((PREDEFINED_ROLES as readonly string[]).includes(role)) {
    return { selectedRole: role, customRole: "" };
  }
  return { selectedRole: "Autre", customRole: role };
}

export function EditClientContactDialog({ contact, clientId }: EditClientContactDialogProps) {
  const derived = deriveRoleState(contact.role);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<string | undefined>(derived.selectedRole);
  const [customRole, setCustomRole] = useState(derived.customRole);

  const resolvedRole = (): string | null => {
    if (!selectedRole) return null;
    if (selectedRole === "Autre") return customRole.trim() || null;
    return selectedRole;
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      const reset = deriveRoleState(contact.role);
      setSelectedRole(reset.selectedRole);
      setCustomRole(reset.customRole);
    }
    setOpen(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string).trim();
    const email = (formData.get("email") as string).trim();

    startTransition(async () => {
      const result = await updateClientContactAction(contact.id, clientId, {
        name,
        email,
        role: resolvedRole(),
      });
      toastResult(result, "Contact modifié");
      if (result.ok) {
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Modifier le contact">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="edit-contact-name">Nom</Label>
            <Input
              id="edit-contact-name"
              name="name"
              required
              minLength={1}
              defaultValue={contact.name}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-contact-email">Email</Label>
            <Input
              id="edit-contact-email"
              name="email"
              type="email"
              required
              defaultValue={contact.email}
            />
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
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "En cours…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
