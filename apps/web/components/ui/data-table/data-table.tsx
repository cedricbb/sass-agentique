"use client";

import * as React from "react";
import { type ReactNode, useState } from "react";
import {
  type ColumnDef,
  type VisibilityState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyState?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  state?: {
    pagination?: PaginationState;
    sorting?: SortingState;
    columnVisibility?: VisibilityState;
  };
  onPaginationChange?: OnChangeFn<PaginationState>;
  onSortingChange?: OnChangeFn<SortingState>;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  manualPagination?: boolean;
  manualSorting?: boolean;
  pageCount?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyState,
  toolbar,
  pageSize = 10,
  state,
  onPaginationChange,
  onSortingChange,
  onColumnVisibilityChange,
  manualPagination,
  manualSorting,
  pageCount,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] =
    useState<VisibilityState>({});
  const [internalPagination, setInternalPagination] =
    useState<PaginationState>({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(!manualPagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(!manualSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
    onSortingChange: onSortingChange ?? setInternalSorting,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
    onColumnVisibilityChange:
      onColumnVisibilityChange ?? setInternalColumnVisibility,
    state: {
      sorting: state?.sorting ?? internalSorting,
      pagination: state?.pagination ?? internalPagination,
      columnVisibility: state?.columnVisibility ?? internalColumnVisibility,
    },
    ...(manualPagination ? { manualPagination: true } : {}),
    ...(manualSorting ? { manualSorting: true } : {}),
    ...(pageCount !== undefined ? { pageCount } : {}),
  });

  return (
    <div>
      {toolbar}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyState ?? "Aucun résultat trouvé."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
