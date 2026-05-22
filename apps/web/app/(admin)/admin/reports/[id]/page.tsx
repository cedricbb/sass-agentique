import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { reportService, listClients, listAllProjects } from "@saas/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportActions } from "./_components/ReportActions";
import { formatDate } from "@/lib/format";

const KIND_LABELS: Record<string, string> = {
  delivery: "Livraison",
  monthly: "Mensuel",
  audit: "Audit",
  other: "Autre",
};

export const metadata: Metadata = { title: "Détail rapport — Admin" };

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await reportService.getReportById(id);
  if (!report) notFound();

  const [clients, projects] = await Promise.all([
    listClients(),
    listAllProjects(),
  ]);

  const client = clients.find((c) => c.id === report.clientId);
  const project = report.projectId
    ? projects.find((p) => p.id === report.projectId)
    : null;
  const isIssued = report.issuedAt !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{report.title}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Informations</CardTitle>
          <ReportActions reportId={report.id} isIssued={isIssued} />
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">Type</dt>
              <dd>
                <Badge variant="outline">
                  {KIND_LABELS[report.kind] ?? report.kind}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Statut</dt>
              <dd data-testid="report-status-badge">
                {isIssued ? (
                  <Badge variant="success">Émis</Badge>
                ) : (
                  <Badge variant="secondary">Brouillon</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd>{client?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Projet</dt>
              <dd>{project?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Émis le</dt>
              <dd>{report.issuedAt ? formatDate(report.issuedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Créé le</dt>
              <dd>{formatDate(report.createdAt)}</dd>
            </div>
            {report.summary && (
              <div className="col-span-2">
                <dt className="text-sm text-muted-foreground">Résumé</dt>
                <dd className="whitespace-pre-wrap">{report.summary}</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-sm text-muted-foreground">Fichier</dt>
              <dd className="font-mono text-xs text-muted-foreground">
                {report.filePath}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src={`/api/reports/${report.id}/file`}
            className="w-full h-[800px] border rounded"
            title={`PDF de ${report.title}`}
            data-testid="report-pdf-viewer"
          />
        </CardContent>
      </Card>
    </div>
  );
}
