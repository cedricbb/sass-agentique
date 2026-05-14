import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listPrestations } from "@saas/services";
import { Button } from "@/components/ui/button";
import { PrestationsTable } from "./_components/PrestationsTable";

export const metadata: Metadata = { title: "Prestations — Admin" };

export default async function PrestationsPage() {
  const prestations = await listPrestations();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prestations</h1>
          <p className="text-muted-foreground">
            Catalogue de prestations ({prestations.length})
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/prestations/new">
            <Plus className="mr-2 size-4" />
            Nouvelle prestation
          </Link>
        </Button>
      </div>
      <PrestationsTable data={prestations} />
    </div>
  );
}
