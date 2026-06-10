"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
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
import { formatCurrency, formatDate } from "@/lib/format";
import type { Payment } from "@saas/db";

interface PaymentsTableProps {
  data: Payment[];
  clientNames: Record<string, string>;
  invoiceNumbers: Record<string, string>;
}

const METHOD_LABELS: Record<string, string> = {
  stripe_card: "Carte Stripe",
  bank_transfer: "Virement",
  other: "Autre",
};

const METHOD_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "stripe_card", label: "Carte Stripe" },
  { value: "bank_transfer", label: "Virement" },
  { value: "other", label: "Autre" },
];

export function PaymentsTable({ data, clientNames, invoiceNumbers }: PaymentsTableProps) {
  const { pagination, sorting, search, setPagination, setSorting, setSearch } =
    useDataTableState({ defaultPageSize: 50 });
  const [method, setMethod] = useQueryState("method", parseAsString.withDefault("all"));

  const filteredData = data.filter((p) => {
    if (search && !(p.externalRef ?? p.id).toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (method !== "all" && p.method !== method) {
      return false;
    }
    return true;
  });

  const toolbar = (
    <div className="flex items-center gap-4 py-4">
      <Input
        placeholder="Rechercher par référence..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 max-w-sm"
        data-testid="payments-search"
      />
      <Select value={method} onValueChange={(v) => setMethod(v)}>
        <SelectTrigger className="h-8 w-[180px]" data-testid="payments-method-filter">
          <SelectValue placeholder="Méthode" />
        </SelectTrigger>
        <SelectContent>
          {METHOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DataTable
      columns={buildColumns(clientNames, invoiceNumbers)}
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
  invoiceNumbers: Record<string, string>,
): ColumnDef<Payment>[] {
  return [
    {
      accessorKey: "externalRef",
      header: "Référence",
      cell: ({ row }) => row.original.externalRef ?? row.original.id.slice(0, 8),
    },
    {
      id: "invoiceNumber",
      header: "Facture",
      cell: ({ row }) => invoiceNumbers[row.original.invoiceId] ?? "—",
    },
    {
      id: "client",
      header: "Client",
      cell: ({ row }) => clientNames[row.original.invoiceId] ?? "—",
    },
    {
      accessorKey: "method",
      header: "Méthode",
      cell: ({ row }) => METHOD_LABELS[row.original.method] ?? row.original.method,
    },
    {
      accessorKey: "amountCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Montant" />
      ),
      cell: ({ row }) => formatCurrency(row.original.amountCents / 100),
    },
    {
      accessorKey: "paidAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Payé le" />
      ),
      cell: ({ row }) => formatDate(row.original.paidAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/admin/invoices/${row.original.invoiceId}`}
            data-testid={`payment-view-${row.original.id}`}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Voir</span>
          </Link>
        </Button>
      ),
    },
  ];
}
