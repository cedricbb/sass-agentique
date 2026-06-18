// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InvoiceRow } from "../InvoiceRow";

const BASE_INVOICE = {
  id: "inv-123",
  date: new Date("2025-01-15"),
  amountCents: 120000,
  status: "paid",
};

describe("InvoiceRow", () => {
  afterEach(cleanup);

  it("renders PDF link when issuedAt is set", () => {
    render(
      <table>
        <tbody>
          <InvoiceRow invoice={{ ...BASE_INVOICE, issuedAt: new Date() }} />
        </tbody>
      </table>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/api/invoices/inv-123/file");
  });

  it("hides PDF link when issuedAt is null", () => {
    render(
      <table>
        <tbody>
          <InvoiceRow invoice={{ ...BASE_INVOICE, issuedAt: null }} />
        </tbody>
      </table>,
    );

    const links = screen.queryAllByRole("link");
    const pdfLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("/api/invoices/"),
    );
    expect(pdfLinks).toHaveLength(0);
  });
});
