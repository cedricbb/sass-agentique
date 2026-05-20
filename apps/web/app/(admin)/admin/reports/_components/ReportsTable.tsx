"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye, FileCheck, Tag, Building2 } from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDataTableState } from "@/lib/hooks/use-data-table-state";
import { formatDate } from "@/lib/format";
import type { Report } from "@saas/db";

interface ReportsTableProps {
  data: Report[];
  clients: Pick<{ id: string; name: string }, "id" | "name">[];
  clientNames: Record<string, string>;
}

const KIND_LABELS: Record<string, string> = {
  delivery: "Livraison",
  monthly: "Mensuel",
  audit: "Audit",
  other: "Autre",
};

export function ReportsTable({ data, clients, clientNames }: ReportsTableProps) {
  const { pagination, sorting, search, setPagination, setSorting, setSearch } =
    useDataTableState({ defaultPageSize: 20 });
  const [kind, setKind] = useQueryState("kind", parseAsString.withDefault("all"));
  const [clientId, setClientId] = useQueryState("clientId", parseAsString.withDefault("all"));
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("all"));

  const filteredData = data.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (kind !== "all" && r.kind !== kind) return false;
    if (clientId !== "all" && r.clientId !== clientId) return false;
    if (status === "draft" && r.issuedAt !== null) return false;
    if (status === "issued" && r.issuedAt === null) return false;
    return true;
  });

  const toolbar = (
    <div className="flex items-center gap-4 py-4">
      <Input
        placeholder="Rechercher..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 max-w-sm"
        data-testid="reports-search"
      />
      <Select value={status} onValueChange={(v) => setStatus(v)}>
        <SelectTrigger className="h-8 w-[180px]" data-testid="reports-filter-status">
          <FileCheck className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="draft">Brouillon</SelectItem>
          <SelectItem value="issued">Émis</SelectItem>
        </SelectContent>
      </Select>
      <Select value={kind} onValueChange={(v) => setKind(v)}>
        <SelectTrigger className="h-8 w-[180px]" data-testid="reports-filter-kind">
          <Tag className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          <SelectItem value="delivery">Livraison</SelectItem>
          <SelectItem value="monthly">Mensuel</SelectItem>
          <SelectItem value="audit">Audit</SelectItem>
          <SelectItem value="other">Autre</SelectItem>
        </SelectContent>
      </Select>
      <Select value={clientId} onValueChange={(v) => setClientId(v)}>
        <SelectTrigger className="h-8 w-[180px]" data-testid="reports-filter-client">
          <Building2 className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les clients</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DataTable
      columns={buildColumns(clientNames)}
      data={filteredData}
      state={{ pagination, sorting }}
      onPaginationChange={setPagination}
      onSortingChange={setSorting}
      toolbar={toolbar}
    />
  );
}

function buildColumns(clientNames: Record<string, string>): ColumnDef<Report>[] {
  return [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => row.original.id.slice(0, 8),
    },
    {
      accessorKey: "title",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Titre" />,
      cell: ({ row }) => row.original.title,
    },
    {
      accessorKey: "kind",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{KIND_LABELS[row.original.kind] ?? row.original.kind}</Badge>
      ),
    },
    {
      id: "status",
      header: "Statut",
      cell: ({ row }) =>
        row.original.issuedAt === null ? (
          <Badge variant="secondary">Brouillon</Badge>
        ) : (
          <Badge variant="success">Émis</Badge>
        ),
    },
    {
      id: "clientId",
      header: "Client",
      cell: ({ row }) => clientNames[row.original.clientId] ?? "—",
    },
    {
      accessorKey: "issuedAt",
      header: "Émis le",
      cell: ({ row }) => (row.original.issuedAt ? formatDate(row.original.issuedAt) : "—"),
    },
    {
      accessorKey: "createdAt",
      header: "Créé le",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/admin/reports/${row.original.id}`}
            data-testid={`report-view-${row.original.id}`}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Voir</span>
          </Link>
        </Button>
      ),
    },
  ];
}
