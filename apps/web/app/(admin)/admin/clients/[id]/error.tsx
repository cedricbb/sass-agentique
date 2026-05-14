"use client";

import { Button } from "@/components/ui/button";

export default function EditClientError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <h2 className="text-xl font-semibold">Erreur</h2>
      <p className="text-muted-foreground">Impossible de charger le client.</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
