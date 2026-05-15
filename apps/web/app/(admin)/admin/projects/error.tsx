"use client";

import { Button } from "@/components/ui/button";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-12">
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-muted-foreground">
        Impossible de charger la liste des projets.
      </p>
      <Button onClick={reset} variant="outline">
        Réessayer
      </Button>
    </div>
  );
}
