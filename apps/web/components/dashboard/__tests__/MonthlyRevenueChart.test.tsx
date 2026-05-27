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
import { MonthlyRevenueChart } from "../MonthlyRevenueChart";

describe("MonthlyRevenueChart", () => {
  it("renders with data without crashing", () => {
    const data = [
      { label: "Jan", revenueTtcCents: 12000 },
      { label: "Fév", revenueTtcCents: 8000 },
    ];
    const { container } = render(<MonthlyRevenueChart data={data} />);
    expect(screen.getByTestId("bar-chart")).toBeDefined();
    expect(container.textContent).not.toContain("Aucune donnée");
  });

  it("renders empty state for data=[]", () => {
    const { container } = render(<MonthlyRevenueChart data={[]} />);
    expect(container.textContent).toContain("Aucune donnée de revenu");
  });
});
