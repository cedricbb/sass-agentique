// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, it, expect } from "vitest";
import {
  useDataTableState,
  type DataTableStateOptions,
} from "../hooks/use-data-table-state";

function TestHarness({
  options,
  searchParams,
}: {
  options?: DataTableStateOptions;
  searchParams?: Record<string, string>;
}) {
  return (
    <NuqsTestingAdapter searchParams={searchParams}>
      <Inner options={options} />
    </NuqsTestingAdapter>
  );
}

function Inner({ options }: { options?: DataTableStateOptions }) {
  const state = useDataTableState(options);
  return (
    <div>
      <span data-testid="pageIndex">{state.pagination.pageIndex}</span>
      <span data-testid="pageSize">{state.pagination.pageSize}</span>
      <span data-testid="sortId">
        {state.sorting.length > 0 ? state.sorting[0].id : ""}
      </span>
      <span data-testid="sortDesc">
        {state.sorting.length > 0 ? String(state.sorting[0].desc) : ""}
      </span>
      <span data-testid="search">{state.search}</span>
      <button
        data-testid="setPagination"
        onClick={() =>
          state.setPagination({ pageIndex: 1, pageSize: 20 })
        }
      />
      <button
        data-testid="setPaginationFn"
        onClick={() =>
          state.setPagination((prev) => ({
            ...prev,
            pageIndex: prev.pageIndex + 1,
          }))
        }
      />
      <button
        data-testid="setSortName"
        onClick={() =>
          state.setSorting([{ id: "name", desc: false }])
        }
      />
      <button
        data-testid="clearSort"
        onClick={() => state.setSorting([])}
      />
      <button
        data-testid="setSearch"
        onClick={() => state.setSearch("bob")}
      />
    </div>
  );
}

afterEach(cleanup);

describe("useDataTableState", () => {
  it("1 — defaults without query params", () => {
    render(<TestHarness />);
    expect(screen.getByTestId("pageIndex").textContent).toBe("0");
    expect(screen.getByTestId("pageSize").textContent).toBe("10");
    expect(screen.getByTestId("sortId").textContent).toBe("");
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("2 — custom defaultPageSize", () => {
    render(<TestHarness options={{ defaultPageSize: 25 }} />);
    expect(screen.getByTestId("pageSize").textContent).toBe("25");
  });

  it("3 — page 1-based → 0-based", () => {
    render(<TestHarness searchParams={{ page: "3" }} />);
    expect(screen.getByTestId("pageIndex").textContent).toBe("2");
  });

  it("4 — setPagination updates values", async () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByTestId("setPagination"));
    expect(screen.getByTestId("pageIndex").textContent).toBe("1");
    expect(screen.getByTestId("pageSize").textContent).toBe("20");
  });

  it("5 — sort=name.asc parsing", () => {
    render(<TestHarness searchParams={{ sort: "name.asc" }} />);
    expect(screen.getByTestId("sortId").textContent).toBe("name");
    expect(screen.getByTestId("sortDesc").textContent).toBe("false");
  });

  it("6 — sort=createdAt.desc parsing", () => {
    render(
      <TestHarness searchParams={{ sort: "createdAt.desc" }} />
    );
    expect(screen.getByTestId("sortId").textContent).toBe("createdAt");
    expect(screen.getByTestId("sortDesc").textContent).toBe("true");
  });

  it("7 — clear sort", async () => {
    render(<TestHarness searchParams={{ sort: "name.asc" }} />);
    fireEvent.click(screen.getByTestId("clearSort"));
    expect(screen.getByTestId("sortId").textContent).toBe("");
  });

  it("8 — search q=alice", () => {
    render(<TestHarness searchParams={{ q: "alice" }} />);
    expect(screen.getByTestId("search").textContent).toBe("alice");
  });

  it("9 — setSearch resets page to 0", async () => {
    render(<TestHarness searchParams={{ page: "5" }} />);
    expect(screen.getByTestId("pageIndex").textContent).toBe("4");
    fireEvent.click(screen.getByTestId("setSearch"));
    expect(screen.getByTestId("pageIndex").textContent).toBe("0");
    expect(screen.getByTestId("search").textContent).toBe("bob");
  });

  it("10 — invalid sort → empty", () => {
    render(<TestHarness searchParams={{ sort: "invalid" }} />);
    expect(screen.getByTestId("sortId").textContent).toBe("");
  });

  it("11 — page=0 in URL → pageIndex=0", () => {
    render(<TestHarness searchParams={{ page: "0" }} />);
    expect(screen.getByTestId("pageIndex").textContent).toBe("0");
  });

  it("12 — page=-1 in URL → pageIndex=0", () => {
    render(<TestHarness searchParams={{ page: "-1" }} />);
    expect(screen.getByTestId("pageIndex").textContent).toBe("0");
  });

  it("13 — sort=name.foo (invalid direction) → empty", () => {
    render(<TestHarness searchParams={{ sort: "name.foo" }} />);
    expect(screen.getByTestId("sortId").textContent).toBe("");
  });

  it("14 — setPagination with updater function", async () => {
    render(<TestHarness searchParams={{ page: "2" }} />);
    expect(screen.getByTestId("pageIndex").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("setPaginationFn"));
    expect(screen.getByTestId("pageIndex").textContent).toBe("2");
  });
});
