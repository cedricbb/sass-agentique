"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Prestation } from "@saas/db";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { useDataTableState } from "@/lib/hooks/use-data-table-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchivePrestationButton } from "./ArchivePrestationButton";

const KIND_LABELS: Record<string, string> = { one_shot: "Ponctuelle", recurring: "Récurrente" };
const KIND_BADGE_VARIANT: Record<string, "default" | "secondary"> = { one_shot: "default", recurring: "secondary" };

const columns: ColumnDef<Prestation>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nom" />
    ),
  },
  {
    accessorKey: "basePriceEurCents",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prix" />
    ),
    cell: ({ row }) => formatCurrency(row.original.basePriceEurCents / 100),
  },
  {
    accessorKey: "kind",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant={KIND_BADGE_VARIANT[row.original.kind]}>
        {KIND_LABELS[row.original.kind]}
      </Badge>
    ),
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
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          asChild
          data-testid={`prestation-edit-${row.original.id}`}
        >
          <Link href={`/admin/prestations/${row.original.id}`}>
            <Pencil className="size-4" />
            <span className="sr-only">Modifier</span>
          </Link>
        </Button>
        <ArchivePrestationButton
          id={row.original.id}
          prestationName={row.original.name}
        />
      </div>
    ),
  },
];

interface PrestationsTableProps {
  data: Prestation[];
}

export function PrestationsTable({ data }: PrestationsTableProps) {
  const { pagination, sorting, search, setPagination, setSorting, setSearch } =
    useDataTableState({ defaultPageSize: 10 });
  const q = search?.toLowerCase();
  const filtered = q
    ? data.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    : data;
  return (
    <DataTable
      columns={columns}
      data={filtered}
      state={{ pagination, sorting }}
      onPaginationChange={setPagination}
      onSortingChange={setSorting}
      toolbar={
        <div className="flex items-center py-4">
          <Input
            data-testid="prestations-search"
            placeholder="Rechercher une prestation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      }
    />
  );
}
