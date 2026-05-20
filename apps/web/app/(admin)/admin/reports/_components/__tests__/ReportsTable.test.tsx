// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { ReportsTable } from "../ReportsTable";
import type { Report } from "@saas/db";

afterEach(() => cleanup());

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

const CLIENT_NAMES: Record<string, string> = {
  "client-acme": "Acme Corp",
  "client-bob": "Bob Indep",
  "client-globex": "Globex",
};

const CLIENTS = [
  { id: "client-acme", name: "Acme Corp" },
  { id: "client-bob", name: "Bob Indep" },
  { id: "client-globex", name: "Globex" },
];

const mockReports: Report[] = [
  {
    id: "rpt-1-abcdefgh",
    clientId: "client-acme",
    projectId: null,
    title: "Livrable v1 site vitrine",
    kind: "delivery",
    summary: null,
    filePath: "reports/2026/01/seed-acme-delivery-draft.pdf",
    issuedAt: null,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    updatedAt: new Date("2026-01-15T10:00:00Z"),
  },
  {
    id: "rpt-2-abcdefgh",
    clientId: "client-bob",
    projectId: null,
    title: "Rapport mensuel maintenance — Janvier 2026",
    kind: "monthly",
    summary: null,
    filePath: "reports/2026/02/seed-bob-monthly.pdf",
    issuedAt: new Date("2026-02-05T10:00:00Z"),
    createdAt: new Date("2026-02-01T10:00:00Z"),
    updatedAt: new Date("2026-02-05T10:00:00Z"),
  },
  {
    id: "rpt-3-abcdefgh",
    clientId: "client-globex",
    projectId: null,
    title: "Audit sécurité Q1 2026",
    kind: "audit",
    summary: null,
    filePath: "reports/2026/03/seed-globex-audit.pdf",
    issuedAt: new Date("2026-03-30T16:00:00Z"),
    createdAt: new Date("2026-03-01T10:00:00Z"),
    updatedAt: new Date("2026-03-30T16:00:00Z"),
  },
] as Report[];

describe("ReportsTable", () => {
  it("renders table with provided data", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Livrable v1 site vitrine")).toBeInTheDocument();
  });

  it("displays expected column headers", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Titre")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Statut")).toBeInTheDocument();
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Émis le")).toBeInTheDocument();
    expect(screen.getByText("Créé le")).toBeInTheDocument();
  });

  it("renders kind labels in French", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Livraison")).toBeInTheDocument();
    expect(screen.getByText("Mensuel")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
  });

  it("renders badge Brouillon variant=secondary for issuedAt=null", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    const badge = screen.getByText("Brouillon");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "secondary");
  });

  it("renders badge Émis variant=success for issuedAt!=null", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    const badges = screen.getAllByText("Émis");
    expect(badges.length).toBe(2);
    expect(badges[0]).toHaveAttribute("data-variant", "success");
  });

  it("resolves client name from clientNames map", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Bob Indep")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });

  it("search input has testid reports-search", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByTestId("reports-search")).toBeInTheDocument();
  });

  it("3 filter Selects with correct testids", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByTestId("reports-filter-status")).toBeInTheDocument();
    expect(screen.getByTestId("reports-filter-kind")).toBeInTheDocument();
    expect(screen.getByTestId("reports-filter-client")).toBeInTheDocument();
  });

  it("action link points to /admin/reports/[id]", () => {
    renderWithNuqs(
      <ReportsTable data={mockReports} clients={CLIENTS} clientNames={CLIENT_NAMES} />,
    );
    const link = screen.getByTestId("report-view-rpt-1-abcdefgh");
    expect(link).toHaveAttribute("href", "/admin/reports/rpt-1-abcdefgh");
  });
});
