"use client";

import * as React from "react";
import { type ReactNode } from "react";
import { type Table } from "@tanstack/react-table";

import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  children?: ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  children,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">{children}</div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
