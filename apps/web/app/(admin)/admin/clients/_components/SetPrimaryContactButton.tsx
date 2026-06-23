"use client";

import * as React from "react";
import { useTransition } from "react";
import { setPrimaryClientContactAction } from "@/app/actions/clients";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface SetPrimaryContactButtonProps {
  contactId: string;
  clientId: string;
}

export function SetPrimaryContactButton({ contactId, clientId }: SetPrimaryContactButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await setPrimaryClientContactAction(contactId, clientId);
      toastResult(result, "Contact défini comme principal");
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Définir comme principal"
      disabled={isPending}
      onClick={handleClick}
    >
      <Star className="h-4 w-4" />
    </Button>
  );
}
