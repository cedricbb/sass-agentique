import { requireCustomer } from "@/lib/auth";
import { listReportsByClient } from "@saas/services/report.service";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { REPORT_KIND_LABELS as KIND_LABELS } from "@saas/services/report.shared";

export default async function CustomerReportsPage() {
  const { client } = await requireCustomer();
  const reports = await listReportsByClient(client.id, { issuedOnly: true });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Mes rapports</h2>
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="reports-empty">
            Aucun rapport pour le moment
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border" data-testid="reports-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Titre</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b last:border-0" data-testid="report-row">
                  <td className="px-4 py-3">
                    <Link
                      href={`/account/reports/${report.id}`}
                      className="font-medium text-primary hover:underline"
                      data-testid="report-link"
                    >
                      {report.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge data-testid="report-kind-badge">
                      {KIND_LABELS[report.kind]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(report.issuedAt!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
