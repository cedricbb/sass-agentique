import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { maintenanceContractService, listClients, listPrestations } from "@saas/services";
import { ContractDetailFields } from "../_components/ContractDetailFields";
import { CancelContractButton } from "../_components/CancelContractButton";

export const metadata: Metadata = { title: "Détail contrat — Admin" };

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contract, clients, prestations] = await Promise.all([
    maintenanceContractService.getContractById(id),
    listClients(),
    listPrestations(),
  ]);

  if (!contract) notFound();

  const clientName = clients.find((c) => c.id === contract.clientId)?.name ?? "—";
  const prestationName = prestations.find((p) => p.id === contract.prestationId)?.name ?? "—";

  return (
    <div className="space-y-6" data-testid="contract-detail">
      <h1 className="text-2xl font-semibold tracking-tight">Détail contrat</h1>
      <ContractDetailFields clientName={clientName} prestationName={prestationName} contract={contract} />
      <CancelContractButton contractId={contract.id} disabled={contract.status === "canceled"} />
    </div>
  );
}
