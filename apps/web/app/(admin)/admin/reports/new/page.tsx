import type { Metadata } from "next";
import { listClients, listAllProjects } from "@saas/services";
import { ReportForm } from "./_components/ReportForm";

export const metadata: Metadata = { title: "Nouveau rapport — Admin" };

export default async function NewReportPage() {
  const [clients, projects] = await Promise.all([
    listClients(),
    listAllProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nouveau rapport</h1>
        <p className="text-muted-foreground">Uploadez un PDF et renseignez les métadonnées.</p>
      </div>
      <ReportForm clients={clients} projects={projects} />
    </div>
  );
}
