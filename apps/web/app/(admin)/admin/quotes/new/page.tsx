import type { Metadata } from "next";
import { listClients, listAllProjects, listClientContactsByOwner } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { QuoteForm } from "../_components/QuoteForm";

export const metadata: Metadata = { title: "Nouveau devis — Admin" };

export default async function NewQuotePage() {
  const user = await requireAdmin();
  const [clients, projects, contacts] = await Promise.all([
    listClients(),
    listAllProjects(),
    listClientContactsByOwner(user.id),
  ]);
  return <QuoteForm clients={clients} projects={projects} contacts={contacts} mode="create" />;
}
