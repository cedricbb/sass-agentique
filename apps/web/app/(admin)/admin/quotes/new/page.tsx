import type { Metadata } from "next";
import { listClients, listAllProjects } from "@saas/services";
import { QuoteForm } from "../_components/QuoteForm";

export const metadata: Metadata = { title: "Nouveau devis — Admin" };

export default async function NewQuotePage() {
  const [clients, projects] = await Promise.all([listClients(), listAllProjects()]);
  return <QuoteForm clients={clients} projects={projects} mode="create" />;
}
