import type { Metadata } from "next";
import { listClients, listPrestations } from "@saas/services";
import { ContractForm } from "../_components/ContractForm";

export const metadata: Metadata = { title: "Nouveau contrat — Admin" };

export default async function NewContractPage() {
  const [clients, allPrestations] = await Promise.all([
    listClients(),
    listPrestations(),
  ]);

  const recurringPrestations = allPrestations.filter((p) => p.kind === "recurring");

  return <ContractForm clients={clients} prestations={recurringPrestations} />;
}
