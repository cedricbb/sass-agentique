"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Download } from "lucide-react";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDataTableState } from "@/lib/hooks/use-data-table-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeInvoiceTtc } from "@saas/services/invoice.shared";
import type { Invoice } from "@saas/db";

interface InvoicesTableProps {
  data: Invoice[];
  clientNames: Record<string, string>;
}

const STATUS_LABELS: Record<Invoice["status"], string> = {
  draft: "Brouillon",
  sent: "Émise",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

const STATUS_BADGE_VARIANT: Record<
  Invoice["status"],
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  draft: "secondary",
  sent: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

export function InvoicesTable({ data, clientNames }: InvoicesTableProps) {
  const { pagination, sorting, search, setPagination, setSorting, setSearch } =
    useDataTableState({ defaultPageSize: 10 });

  const filteredData = search
    ? data.filter((inv) =>
        inv.number.toLowerCase().includes(search.toLowerCase()),
      )
    : data;

  const toolbar = (
    <div className="flex items-center py-4">
      <Input
        placeholder="Rechercher une facture..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 max-w-sm"
        data-testid="invoices-search"
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
): ColumnDef<Invoice>[] {
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
          computeInvoiceTtc({
            totalEurCents: row.original.totalEurCents,
            vatRateBps: row.original.vatRateBps,
          }).totalTtcCents / 100,
        ),
    },
    {
      accessorKey: "issuedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Émise le" />
      ),
      cell: ({ row }) =>
        row.original.issuedAt ? formatDate(row.original.issuedAt) : "—",
    },
    {
      accessorKey: "dueAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Échéance" />
      ),
      cell: ({ row }) =>
        row.original.dueAt ? formatDate(row.original.dueAt) : "—",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.issuedAt != null && (
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`/api/invoices/${row.original.id}/file`}
                download={`facture-${row.original.number}.pdf`}
                data-testid={`invoice-download-${row.original.id}`}
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Télécharger le PDF</span>
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/admin/invoices/${row.original.id}`}
              data-testid={`invoice-edit-${row.original.id}`}
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
