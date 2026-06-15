// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { PrestationsTable } from "../PrestationsTable";
import type { Prestation } from "@saas/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/actions/prestations", () => ({
  archivePrestationAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn(),
}));

afterEach(() => cleanup());

const makePrestation = (overrides: Partial<Prestation> = {}): Prestation => ({
  id: "00000000-0000-0000-0000-000000000001",
  slug: "test-prestation",
  name: "Test Prestation",
  description: "A test prestation",
  basePriceEurCents: 5000,
  kind: "one_shot",
  stripeProductId: null,
  stripePriceId: null,
  isActive: true,
  sortOrder: 0,
  ownerId: "u1",
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  ...overrides,
});

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

describe("PrestationsTable", () => {
  it("renders prestation rows", () => {
    const prestations = [
      makePrestation({ id: "id-1", name: "Audit SEO" }),
      makePrestation({ id: "id-2", name: "Refonte site" }),
    ];
    renderWithNuqs(<PrestationsTable data={prestations} />);
    expect(screen.getByText("Audit SEO")).toBeInTheDocument();
    expect(screen.getByText("Refonte site")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    renderWithNuqs(<PrestationsTable data={[]} />);
    expect(screen.getByText("Aucun résultat trouvé.")).toBeInTheDocument();
  });

  it("renders search input with data-testid", () => {
    renderWithNuqs(<PrestationsTable data={[]} />);
    expect(screen.getByTestId("prestations-search")).toBeInTheDocument();
  });

  it("renders edit link per row", () => {
    const p = makePrestation({ id: "abc-123" });
    renderWithNuqs(<PrestationsTable data={[p]} />);
    expect(screen.getByTestId("prestation-edit-abc-123")).toBeInTheDocument();
  });

  it("formats price in EUR currency", () => {
    const p = makePrestation({ basePriceEurCents: 5000 });
    renderWithNuqs(<PrestationsTable data={[p]} />);
    const matches = screen.getAllByText((_content, element) => {
      if (element?.tagName !== "TD") return false;
      const text = element?.textContent?.normalize("NFKD") ?? "";
      return text.includes("50,00") && text.includes("€");
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("displays 0,00 € for zero price", () => {
    const p = makePrestation({ basePriceEurCents: 0 });
    renderWithNuqs(<PrestationsTable data={[p]} />);
    const matches = screen.getAllByText((_content, element) => {
      if (element?.tagName !== "TD") return false;
      const text = element?.textContent?.normalize("NFKD") ?? "";
      return text.includes("0,00") && text.includes("€");
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("displays badge Ponctuelle for one_shot kind", () => {
    const p = makePrestation({ kind: "one_shot" });
    renderWithNuqs(<PrestationsTable data={[p]} />);
    expect(screen.getByText("Ponctuelle")).toBeInTheDocument();
  });

  it("displays badge Récurrente for recurring kind", () => {
    const p = makePrestation({ kind: "recurring" });
    renderWithNuqs(<PrestationsTable data={[p]} />);
    expect(screen.getByText("Récurrente")).toBeInTheDocument();
  });

  it("filters by name", () => {
    const prestations = [
      makePrestation({ id: "id-1", name: "Audit SEO" }),
      makePrestation({ id: "id-2", name: "Refonte site" }),
    ];
    renderWithNuqs(<PrestationsTable data={prestations} />);
    fireEvent.change(screen.getByTestId("prestations-search"), { target: { value: "Audit" } });
    expect(screen.getByText("Audit SEO")).toBeInTheDocument();
    expect(screen.queryByText("Refonte site")).not.toBeInTheDocument();
  });

  it("filters by description", () => {
    const prestations = [
      makePrestation({ id: "id-1", name: "A", description: "conseil marketing" }),
      makePrestation({ id: "id-2", name: "B", description: "dev web" }),
    ];
    renderWithNuqs(<PrestationsTable data={prestations} />);
    fireEvent.change(screen.getByTestId("prestations-search"), { target: { value: "marketing" } });
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("handles null description in filter", () => {
    const prestations = [
      makePrestation({ id: "id-1", name: "Audit", description: null }),
      makePrestation({ id: "id-2", name: "Refonte", description: "marketing" }),
    ];
    renderWithNuqs(<PrestationsTable data={prestations} />);
    fireEvent.change(screen.getByTestId("prestations-search"), { target: { value: "marketing" } });
    expect(screen.queryByText("Audit")).not.toBeInTheDocument();
    expect(screen.getByText("Refonte")).toBeInTheDocument();
  });

  it("formats createdAt date", () => {
    const p = makePrestation({ createdAt: new Date("2024-03-20") });
    renderWithNuqs(<PrestationsTable data={[p]} />);
    expect(screen.getByText("20/03/2024")).toBeInTheDocument();
  });

  it("prestations_table_renders_archive_button_per_row", () => {
    const prestations = [
      makePrestation({ id: "id-1" }),
      makePrestation({ id: "id-2" }),
    ];
    renderWithNuqs(<PrestationsTable data={prestations} />);
    const buttons = screen.getAllByTestId("archive-prestation-trigger");
    expect(buttons).toHaveLength(2);
  });
});
