import { notFound } from "next/navigation";
import { requireCustomer, assertClientOwnership } from "@/lib/auth";
import { getReportById } from "@saas/services/report.service";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { REPORT_KIND_LABELS as KIND_LABELS } from "@saas/services/report.shared";

export default async function CustomerReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireCustomer();
  const report = await getReportById(id);

  if (!report || !report.issuedAt) notFound();

  assertClientOwnership(report, scope);

  return (
    <div className="space-y-6" data-testid="report-detail">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{report.title}</h2>
        <Badge data-testid="report-kind-badge">
          {KIND_LABELS[report.kind]}
        </Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        <span data-testid="report-issued-date">
          Émis le {formatDate(report.issuedAt)}
        </span>
      </div>

      {report.summary && (
        <p className="text-sm" data-testid="report-summary">
          {report.summary}
        </p>
      )}

      <div>
        <a
          href={`/api/account/reports/${report.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
          data-testid="report-pdf-link"
        >
          Télécharger le PDF
        </a>
      </div>
    </div>
  );
}
