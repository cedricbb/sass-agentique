// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { ClientsTable } from "../ClientsTable";
import type { Client } from "@saas/db";

afterEach(() => cleanup());

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Test Client",
  slug: "test-client",
  type: "company",
  email: "test@example.com",
  phone: "+33 1 23 45 67 89",
  billingAddress: null,
  notes: null,
  archivedAt: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  ...overrides,
});

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

describe("ClientsTable", () => {
  it("renders client rows", () => {
    const clients = [
      makeClient({ id: "id-1", name: "Acme Corp", email: "acme@test.com" }),
      makeClient({ id: "id-2", name: "Beta Inc", email: "beta@test.com" }),
    ];
    renderWithNuqs(<ClientsTable data={clients} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    renderWithNuqs(<ClientsTable data={[]} />);
    expect(screen.getByText("Aucun résultat trouvé.")).toBeInTheDocument();
  });

  it("renders search input with data-testid", () => {
    renderWithNuqs(<ClientsTable data={[]} />);
    expect(screen.getByTestId("clients-search")).toBeInTheDocument();
  });

  it("displays dash for null phone", () => {
    const client = makeClient({ phone: null });
    renderWithNuqs(<ClientsTable data={[client]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders edit link per row", () => {
    const client = makeClient({ id: "abc-123" });
    renderWithNuqs(<ClientsTable data={[client]} />);
    expect(screen.getByTestId("client-edit-abc-123")).toBeInTheDocument();
  });

  it("formats createdAt date", () => {
    const client = makeClient({ createdAt: new Date("2024-03-20") });
    renderWithNuqs(<ClientsTable data={[client]} />);
    expect(screen.getByText("20/03/2024")).toBeInTheDocument();
  });
});
