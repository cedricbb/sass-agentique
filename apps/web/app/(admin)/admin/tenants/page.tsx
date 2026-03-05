import { listAdminTenants } from "@saas/services";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { TenantPlanSelect } from "@/components/admin/TenantPlanSelect";
import { AdminPagination } from "@/components/admin/AdminPagination";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const PAGE_SIZE = 20;

const PLAN_STYLES: Record<string, string> = {
  free: "bg-slate-100 text-slate-700",
  pro: "bg-blue-100 text-blue-700",
  business: "bg-violet-100 text-violet-700",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminTenantsPage({ searchParams }: PageProps) {
  const { q, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));

  const { tenants, total } = await listAdminTenants({
    search: q,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString("fr-FR")} workspace{total !== 1 ? "s" : ""}
          </p>
        </div>
        <AdminSearch placeholder="Nom, slug…" />
      </div>

      <div className="rounded-lg border border-border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Nom</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Membres</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Changer plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucun tenant trouvé
                </TableCell>
              </TableRow>
            )}
            {tenants.map((tenant) => (
              <TableRow key={tenant.id} className="text-sm">
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {tenant.slug}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      PLAN_STYLES[tenant.plan] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tenant.plan}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tenant.memberCount}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(tenant.createdAt)}
                </TableCell>
                <TableCell>
                  <TenantPlanSelect
                    tenantId={tenant.id}
                    currentPlan={tenant.plan}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <AdminPagination currentPage={currentPage} totalPages={totalPages} />
      )}
    </div>
  );
}
