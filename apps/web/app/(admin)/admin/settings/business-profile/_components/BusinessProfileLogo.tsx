"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastResult } from "@/lib/toast";
import {
  uploadBusinessProfileLogoAction,
  removeBusinessProfileLogoAction,
} from "@/app/actions/business-profile";

interface BusinessProfileLogoProps {
  hasLogo: boolean;
  version: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg"]);

export function BusinessProfileLogo({ hasLogo, version }: BusinessProfileLogoProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setValidationError("Le logo doit être un PNG ou un JPEG.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setValidationError("Le fichier dépasse 2 MB.");
      return;
    }

    setValidationError(null);
    const formData = new FormData();
    formData.append("logo", file);

    setIsPending(true);
    try {
      const result = await uploadBusinessProfileLogoAction(formData);
      if (toastResult(result, "Logo enregistré")) {
        router.refresh();
      }
    } finally {
      setIsPending(false);
      event.target.value = "";
    }
  }

  async function handleRemove() {
    setIsPending(true);
    try {
      const result = await removeBusinessProfileLogoAction();
      if (toastResult(result, "Logo retiré")) {
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {hasLogo ? (
        <img
          src={`/api/admin/business-profile/logo?v=${version}`}
          alt="Logo"
          className="h-24 w-auto object-contain"
          data-testid="business-profile-logo-preview"
        />
      ) : (
        <p className="text-muted-foreground text-sm">Aucun logo</p>
      )}

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          data-testid="logo-file-input"
          className="hidden"
          onChange={handleFileChange}
        />

        {validationError && (
          <p className="text-destructive text-sm" role="alert">
            {validationError}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            data-testid="logo-upload-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Téléverser le logo
          </Button>

          {hasLogo && (
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              data-testid="logo-remove-button"
              onClick={handleRemove}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirer le logo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
