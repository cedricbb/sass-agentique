import { notFound } from "next/navigation";
import { getProjectById, listClients } from "@saas/services";
import { Badge } from "@/components/ui/badge";
import { ProjectForm } from "../_components/ProjectForm";
import { ProjectStatusActions } from "../_components/ProjectStatusActions";

export const metadata = { title: "Modifier le projet — Admin" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  active: "Actif",
  on_hold: "En pause",
  delivered: "Livré",
  cancelled: "Annulé",
};

export default async function EditProjectPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, clients] = await Promise.all([getProjectById(id), listClients()]);
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Modifier le projet</h1>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cycle de vie</h2>
        <p className="text-sm text-muted-foreground">
          Statut actuel : <Badge>{STATUS_LABELS[project.status] ?? project.status}</Badge>
        </p>
        <ProjectStatusActions projectId={project.id} projectName={project.name} currentStatus={project.status} />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Informations</h2>
        <ProjectForm initialData={project} clients={clients} />
      </section>
    </div>
  );
}
