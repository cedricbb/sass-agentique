import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listInvoices, getClientNamesByIds } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { InvoicesTable } from "./_components/InvoicesTable";

export const metadata: Metadata = { title: "Factures — Admin" };

export default async function InvoicesPage() {
  const user = await requireAdmin();
  const invoices = await listInvoices({ ownerId: user.id });
  const clientIds = [...new Set(invoices.map((i) => i.clientId))];
  const clientLookup = await getClientNamesByIds(clientIds);
  const clientNames: Record<string, string> = Object.fromEntries(
    Object.entries(clientLookup).map(([id, { name, archived }]) => [
      id,
      archived ? `${name} (archivé)` : name,
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Factures</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos factures ({invoices.length})
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle facture
          </Link>
        </Button>
      </div>
      <InvoicesTable data={invoices} clientNames={clientNames} />
    </div>
  );
}
