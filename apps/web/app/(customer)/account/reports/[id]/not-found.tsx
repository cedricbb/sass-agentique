import Link from "next/link";

export default function CustomerReportNotFound() {
  return (
    <div className="space-y-4 py-8 text-center" data-testid="report-not-found">
      <h2 className="text-lg font-semibold">Rapport introuvable</h2>
      <p className="text-sm text-muted-foreground">
        Ce rapport n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <Link
        href="/account/reports"
        className="text-sm text-primary hover:underline"
        data-testid="report-not-found-back"
      >
        Retour aux rapports
      </Link>
    </div>
  );
}
