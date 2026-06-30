import type { Metadata } from "next";
import Link from "next/link";
import { listClientsByOwner } from "@saas/services";
import { Button } from "@/components/ui/button";
import { ClientsTable } from "./_components/ClientsTable";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Clients — Admin" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await searchParams;
  const user = await requireAdmin();
  const clients = await listClientsByOwner(user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button asChild>
          <Link href="/admin/clients/new">Nouveau client</Link>
        </Button>
      </div>
      <ClientsTable data={clients} />
    </div>
  );
}
