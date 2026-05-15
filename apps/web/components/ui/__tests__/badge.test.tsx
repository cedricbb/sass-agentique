// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "../badge";

afterEach(cleanup);

describe("Badge – variant success", () => {
  it("renders with data-variant='success'", () => {
    render(<Badge variant="success">OK</Badge>);
    const badge = screen.getByText("OK");
    expect(badge).toHaveAttribute("data-variant", "success");
  });

  it("applies bg-green class", () => {
    render(<Badge variant="success">OK</Badge>);
    const badge = screen.getByText("OK");
    expect(badge.className).toMatch(/bg-green/);
  });
});
