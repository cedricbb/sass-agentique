// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";
import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";

afterEach(() => cleanup());

import { DataTable } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { DataTableToolbar } from "../data-table-toolbar";
import { DataTableColumnHeader } from "../data-table-column-header";

type Row = { id: number; name: string; email: string };

const sampleData: Row[] = [
  { id: 1, name: "Alice", email: "alice@test.com" },
  { id: 2, name: "Bob", email: "bob@test.com" },
  { id: 3, name: "Carol", email: "carol@test.com" },
];

const sampleColumns: ColumnDef<Row>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Nom" },
  { accessorKey: "email", header: "Email" },
];

describe("DataTable", () => {
  it("renders data rows", () => {
    const { getByText } = render(
      <DataTable columns={sampleColumns} data={sampleData} />,
    );
    expect(getByText("Alice")).toBeInTheDocument();
    expect(getByText("Bob")).toBeInTheDocument();
    expect(getByText("Carol")).toBeInTheDocument();
  });

  it("displays column headers", () => {
    const { getByText } = render(
      <DataTable columns={sampleColumns} data={sampleData} />,
    );
    expect(getByText("Nom")).toBeInTheDocument();
    expect(getByText("Email")).toBeInTheDocument();
  });

  it("shows default empty state", () => {
    const { getByText } = render(
      <DataTable columns={sampleColumns} data={[]} />,
    );
    expect(getByText("Aucun résultat trouvé.")).toBeInTheDocument();
  });

  it("shows custom empty state", () => {
    const { getByText } = render(
      <DataTable
        columns={sampleColumns}
        data={[]}
        emptyState={<div>Custom</div>}
      />,
    );
    expect(getByText("Custom")).toBeInTheDocument();
  });
});

function PaginationFixture({ data }: { data: Row[] }) {
  const table = useReactTable({
    data,
    columns: sampleColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return <DataTablePagination table={table} />;
}

describe("DataTablePagination", () => {
  it("displays page X sur Y", () => {
    const { getByText } = render(<PaginationFixture data={sampleData} />);
    expect(getByText(/Page 1 sur/)).toBeInTheDocument();
  });

  it("disables buttons on single page", () => {
    const { getByRole } = render(
      <PaginationFixture data={[sampleData[0]]} />,
    );
    const prev = getByRole("button", { name: /Précédent/i });
    const next = getByRole("button", { name: /Suivant/i });
    expect(prev).toBeDisabled();
    expect(next).toBeDisabled();
  });
});

describe("DataTableColumnHeader", () => {
  it("toggles sort on click", () => {
    const sortableColumns: ColumnDef<Row>[] = [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nom" />
        ),
      },
      { accessorKey: "email", header: "Email" },
    ];

    const { getByRole, getByText } = render(
      <DataTable columns={sortableColumns} data={sampleData} />,
    );

    const sortButton = getByRole("button", { name: /Nom/i });
    fireEvent.click(sortButton);

    expect(getByText("Alice")).toBeInTheDocument();
  });
});

describe("DataTableToolbar", () => {
  function ToolbarFixture() {
    const table = useReactTable({
      data: sampleData,
      columns: sampleColumns,
      getCoreRowModel: getCoreRowModel(),
    });
    return (
      <DataTableToolbar table={table}>
        <div data-testid="filter">Filter</div>
      </DataTableToolbar>
    );
  }

  it("renders children and ViewOptions", () => {
    const { getByTestId, getByRole } = render(<ToolbarFixture />);
    expect(getByTestId("filter")).toBeInTheDocument();
    expect(getByRole("button", { name: /Colonnes/i })).toBeInTheDocument();
  });
});
