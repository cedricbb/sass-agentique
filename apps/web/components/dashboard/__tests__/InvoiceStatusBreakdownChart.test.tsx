// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: any) => React.createElement("div", { "data-testid": "responsive" }, children),
    BarChart: ({ children }: any) => React.createElement("div", { "data-testid": "bar-chart" }, children),
    Bar: () => React.createElement("div"),
    XAxis: () => React.createElement("div"),
    YAxis: () => React.createElement("div"),
    CartesianGrid: () => React.createElement("div"),
    Tooltip: () => React.createElement("div"),
  };
});

import { render, screen } from "@testing-library/react";
import { InvoiceStatusBreakdownChart } from "../InvoiceStatusBreakdownChart";

describe("InvoiceStatusBreakdownChart", () => {
  it("renders with data without crashing", () => {
    const data = [
      { status: "Brouillon", count: 3 },
      { status: "Envoyée", count: 2 },
    ];
    const { container } = render(<InvoiceStatusBreakdownChart data={data} />);
    expect(screen.getByTestId("bar-chart")).toBeDefined();
    expect(container.textContent).not.toContain("Aucune facture");
  });

  it("renders empty state for data=[]", () => {
    const { container } = render(<InvoiceStatusBreakdownChart data={[]} />);
    expect(container.textContent).toContain("Aucune facture");
  });
});
