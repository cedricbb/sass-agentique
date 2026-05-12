import { listAdminAgentTasks } from "@saas/services";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AgentTaskStatusFilter } from "@/components/admin/AgentTaskStatusFilter";
import { AgentTaskLogsDrawer } from "@/components/admin/AgentTaskLogsDrawer";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminAgentTasksPage({ searchParams }: PageProps) {
  const { status, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));

  const { tasks, total } = await listAdminAgentTasks({
    status,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tâches Agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString("fr-FR")} tâche{total !== 1 ? "s" : ""}
            {status ? ` · filtre : ${status}` : ""}
          </p>
        </div>
        <AgentTaskStatusFilter currentStatus={status} />
      </div>

      <div className="rounded-lg border border-border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé</TableHead>
              <TableHead>Mis à jour</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucune tâche trouvée
                </TableCell>
              </TableRow>
            )}
            {tasks.map((task) => (
              <TableRow key={task.id} className="text-sm">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {task.id.slice(0, 8)}…
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">
                    {task.agentType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[task.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {task.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(task.createdAt)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {timeAgo(task.updatedAt)}
                </TableCell>
                <TableCell>
                  <AgentTaskLogsDrawer taskId={task.id} />
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
