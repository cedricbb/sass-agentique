import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listQuotes, getClientNamesByIds } from "@saas/services";
import { Button } from "@/components/ui/button";
import { QuotesTable } from "./_components/QuotesTable";

export const metadata: Metadata = { title: "Devis — Admin" };

export default async function QuotesPage() {
  const quotes = await listQuotes();
  const clientIds = [...new Set(quotes.map((q) => q.clientId))];
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
          <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos devis ({quotes.length})
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/quotes/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau devis
          </Link>
        </Button>
      </div>
      <QuotesTable data={quotes} clientNames={clientNames} />
    </div>
  );
}
