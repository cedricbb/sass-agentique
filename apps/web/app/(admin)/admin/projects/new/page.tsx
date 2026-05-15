import { listClients } from "@saas/services";
import { ProjectForm } from "../_components/ProjectForm";

export const metadata = { title: "Nouveau projet — Admin" };

export default async function NewProjectPage() {
  const clients = await listClients();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau projet</h1>
      <ProjectForm clients={clients} />
    </div>
  );
}
