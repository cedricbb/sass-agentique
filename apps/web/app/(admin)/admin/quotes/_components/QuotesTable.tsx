"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, Pencil } from "lucide-react";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDataTableState } from "@/lib/hooks/use-data-table-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeQuoteTtc } from "@saas/services/quote.shared";
import type { Quote } from "@saas/db";

interface QuotesTableProps {
  data: Quote[];
  clientNames: Record<string, string>;
}

const STATUS_LABELS: Record<Quote["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  declined: "Refusé",
  expired: "Expiré",
};

const STATUS_BADGE_VARIANT: Record<
  Quote["status"],
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  draft: "secondary",
  sent: "default",
  accepted: "success",
  declined: "destructive",
  expired: "outline",
};

export function QuotesTable({ data, clientNames }: QuotesTableProps) {
  const { pagination, sorting, search, setPagination, setSorting, setSearch } =
    useDataTableState({ defaultPageSize: 10 });

  const filteredData = search
    ? data.filter((q) =>
        q.number.toLowerCase().includes(search.toLowerCase()),
      )
    : data;

  const toolbar = (
    <div className="flex items-center py-4">
      <Input
        placeholder="Rechercher un devis..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 max-w-sm"
        data-testid="quotes-search"
      />
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

function buildColumns(
  clientNames: Record<string, string>,
): ColumnDef<Quote>[] {
  return [
    {
      accessorKey: "number",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Numéro" />
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
      accessorKey: "totalEurCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Montant TTC" />
      ),
      cell: ({ row }) =>
        formatCurrency(
          computeQuoteTtc({
            totalEurCents: row.original.totalEurCents,
            vatRateBps: row.original.vatRateBps,
          }).totalTtcCents / 100,
        ),
    },
    {
      accessorKey: "issuedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Émis le" />
      ),
      cell: ({ row }) =>
        row.original.issuedAt ? formatDate(row.original.issuedAt) : "—",
    },
    {
      accessorKey: "expiresAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Expire le" />
      ),
      cell: ({ row }) =>
        row.original.expiresAt ? formatDate(row.original.expiresAt) : "—",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.issuedAt != null && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`/api/quotes/${row.original.id}/file`}
                download={`devis-${row.original.number}.pdf`}
                data-testid={`quote-download-${row.original.id}`}
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Télécharger le PDF</span>
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/admin/quotes/${row.original.id}`}
              data-testid={`quote-edit-${row.original.id}`}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Modifier</span>
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
