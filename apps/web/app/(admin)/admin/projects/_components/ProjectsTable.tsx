"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDataTableState } from "@/lib/hooks/use-data-table-state";
import { formatDate } from "@/lib/format";
import type { Project } from "@saas/db";

interface ProjectsTableProps {
  data: Project[];
  clientNames: Record<string, string>;
}

const STATUS_LABELS: Record<Project["status"], string> = {
  draft: "Brouillon",
  active: "Actif",
  on_hold: "En pause",
  delivered: "Livré",
  cancelled: "Annulé",
};

const STATUS_BADGE_VARIANT: Record<
  Project["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  active: "default",
  on_hold: "outline",
  delivered: "secondary",
  cancelled: "destructive",
};

export function ProjectsTable({ data, clientNames }: ProjectsTableProps) {
  const { pagination, sorting, search, setPagination, setSorting, setSearch } =
    useDataTableState({ defaultPageSize: 10 });

  const toolbar = (
    <div className="flex items-center py-4">
      <Input
        placeholder="Rechercher un projet..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 max-w-sm"
        data-testid="projects-search"
      />
    </div>
  );

  return (
    <DataTable
      columns={buildColumns(clientNames)}
      data={data}
      state={{ pagination, sorting }}
      onPaginationChange={setPagination}
      onSortingChange={setSorting}
      toolbar={toolbar}
    />
  );
}

function buildColumns(
  clientNames: Record<string, string>,
): ColumnDef<Project>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nom" />
      ),
    },
    {
      id: "client",
      header: "Client",
      cell: ({ row }) => clientNames[row.original.clientId] ?? "—",
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }) => (
        <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
          {STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: "startedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Démarré le" />
      ),
      cell: ({ row }) =>
        row.original.startedAt ? formatDate(row.original.startedAt) : "—",
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Créé le" />
      ),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/admin/projects/${row.original.id}`}
            data-testid={`project-edit-${row.original.id}`}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Modifier</span>
          </Link>
        </Button>
      ),
    },
  ];
}
