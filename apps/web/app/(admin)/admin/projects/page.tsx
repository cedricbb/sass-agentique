import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listAllProjects, listClients } from "@saas/services";
import { Button } from "@/components/ui/button";
import { ProjectsTable } from "./_components/ProjectsTable";

export const metadata: Metadata = { title: "Projets — Admin" };

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    listAllProjects(),
    listClients(),
  ]);

  const clientNames: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos projets ({projects.length})
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau projet
          </Link>
        </Button>
      </div>
      <ProjectsTable data={projects} clientNames={clientNames} />
    </div>
  );
}
