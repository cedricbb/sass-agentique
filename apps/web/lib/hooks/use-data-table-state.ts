"use client";

import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import type { PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { useMemo, useCallback } from "react";

export interface DataTableStateOptions {
  defaultPageSize?: number;
  defaultSort?: SortingState;
}

export interface DataTableStateReturn {
  pagination: PaginationState;
  sorting: SortingState;
  search: string;
  setPagination: (updater: Updater<PaginationState>) => void;
  setSorting: (updater: Updater<SortingState>) => void;
  setSearch: (value: string) => void;
}

function parseSort(str: string): SortingState {
  if (!str) return [];
  const lastDot = str.lastIndexOf(".");
  if (lastDot === -1) return [];
  const id = str.slice(0, lastDot);
  const dir = str.slice(lastDot + 1);
  if (dir !== "asc" && dir !== "desc") return [];
  if (!id) return [];
  return [{ id, desc: dir === "desc" }];
}

function serializeSort(state: SortingState): string {
  if (state.length === 0) return "";
  return `${state[0].id}.${state[0].desc ? "desc" : "asc"}`;
}

function resolvePagination(updater: Updater<PaginationState>, current: PaginationState) {
  const next = typeof updater === "function" ? updater(current) : updater;
  return { page: next.pageIndex + 1, pageSize: next.pageSize };
}

function resolveSorting(updater: Updater<SortingState>, current: SortingState) {
  const next = typeof updater === "function" ? updater(current) : updater;
  return { sort: serializeSort(next) };
}

export function useDataTableState(options?: DataTableStateOptions): DataTableStateReturn {
  const defaultPageSize = options?.defaultPageSize ?? 10;
  const defaultSort = options?.defaultSort ?? [];
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(defaultPageSize),
    sort: parseAsString.withDefault(serializeSort(defaultSort)),
    q: parseAsString.withDefault(""),
  });
  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: Math.max(params.page - 1, 0), pageSize: params.pageSize }),
    [params.page, params.pageSize]
  );
  const sorting: SortingState = useMemo(() => parseSort(params.sort), [params.sort]);
  const setPagination = useCallback(
    (updater: Updater<PaginationState>) => setParams(resolvePagination(updater, pagination)),
    [pagination, setParams]
  );
  const setSorting = useCallback(
    (updater: Updater<SortingState>) => setParams(resolveSorting(updater, sorting)),
    [sorting, setParams]
  );
  const setSearch = useCallback(
    (value: string) => setParams({ q: value, page: 1 }),
    [setParams]
  );
  return { pagination, sorting, search: params.q, setPagination, setSorting, setSearch };
}
