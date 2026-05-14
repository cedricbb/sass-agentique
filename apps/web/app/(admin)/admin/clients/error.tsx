"use client";

import { Button } from "@/components/ui/button";

export default function ClientsError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-muted-foreground">
        Impossible de charger la liste des clients.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
