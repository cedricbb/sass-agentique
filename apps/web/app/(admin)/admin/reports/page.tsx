import type { Metadata } from "next";
import { reportService, listClients } from "@saas/services";
import { listReportsParamsSchema } from "@/lib/schemas/report.schemas";
import { ReportsTable } from "./_components/ReportsTable";

export const metadata: Metadata = { title: "Rapports — Admin" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = listReportsParamsSchema.safeParse(raw);
  const params = parsed.success ? parsed.data : listReportsParamsSchema.parse({});

  const serviceFilters = {
    kind: params.kind,
    undatedOnly: params.status === "draft" ? true : undefined,
  };

  const [reports, clients] = await Promise.all([
    reportService.listAllReports(serviceFilters),
    listClients(),
  ]);

  const clientNameMap: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name]),
  );

  const filtered = reports
    .filter((r) => params.status !== "issued" || r.issuedAt !== null)
    .filter((r) => !params.clientId || r.clientId === params.clientId)
    .filter((r) => !params.search || r.title.toLowerCase().includes(params.search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
        <p className="text-sm text-muted-foreground">
          Gérez vos rapports ({filtered.length})
        </p>
      </div>
      <ReportsTable data={filtered} clients={clients} clientNames={clientNameMap} />
    </div>
  );
}
