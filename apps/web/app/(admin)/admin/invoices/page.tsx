import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listInvoices, listClients } from "@saas/services";
import { Button } from "@/components/ui/button";
import { InvoicesTable } from "./_components/InvoicesTable";

export const metadata: Metadata = { title: "Factures — Admin" };

export default async function InvoicesPage() {
  const [invoices, clients] = await Promise.all([
    listInvoices(),
    listClients(),
  ]);

  const clientNames: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name]),
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
