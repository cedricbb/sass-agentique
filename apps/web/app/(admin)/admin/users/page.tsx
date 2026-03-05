import { listAdminUsers } from "@saas/services";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { UserActions } from "@/components/admin/UserActions";
import { AdminPagination } from "@/components/admin/AdminPagination";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { q, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));

  const { users, total } = await listAdminUsers({
    search: q,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString("fr-FR")} utilisateur{total !== 1 ? "s" : ""}
          </p>
        </div>
        <AdminSearch placeholder="Email, nom…" />
      </div>

      <div className="rounded-lg border border-border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Email</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Email vérifié</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id} className="text-sm">
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {user.name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.totpEnabled ? "default" : "outline"}
                    className="text-xs"
                  >
                    {user.totpEnabled ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.emailVerified ? "default" : "outline"}
                    className="text-xs"
                  >
                    {user.emailVerified ? "Oui" : "Non"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.bannedAt ? (
                    <Badge variant="destructive" className="text-xs">
                      Banni
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs text-emerald-600 border-emerald-200"
                    >
                      Actif
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <UserActions
                    userId={user.id}
                    isBanned={user.bannedAt !== null}
                    totpEnabled={user.totpEnabled}
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
