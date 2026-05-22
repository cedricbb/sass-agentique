import type { Metadata } from "next";
import { maintenanceContractService, listClients, listPrestations } from "@saas/services";
import { ContractsTable } from "./_components/ContractsTable";

export const metadata: Metadata = { title: "Contrats — Admin" };

function buildNameMap<T extends { id: string; name: string }>(items: T[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.name]));
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;

  const [contracts, clients, prestations] = await Promise.all([
    maintenanceContractService.listAllContracts(),
    listClients(),
    listPrestations(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contrats</h1>
        <p className="text-sm text-muted-foreground">
          Gérez vos contrats de maintenance ({contracts.length})
        </p>
      </div>
      <ContractsTable data={contracts} clientNames={buildNameMap(clients)} prestationNames={buildNameMap(prestations)} />
    </div>
  );
}
