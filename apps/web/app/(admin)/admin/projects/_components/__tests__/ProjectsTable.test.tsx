// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { ProjectsTable } from "../ProjectsTable";
import type { Project } from "@saas/db";

afterEach(() => cleanup());

function renderWithNuqs(ui: React.ReactElement) {
  return render(<NuqsTestingAdapter>{ui}</NuqsTestingAdapter>);
}

const CLIENT_NAMES: Record<string, string> = {
  "c-acme": "Acme Corp",
  "c-beta": "Beta SAS",
};

const mockProjects: Project[] = [
  {
    id: "p-1",
    clientId: "c-acme",
    slug: "site-web-acme",
    name: "Site web Acme",
    status: "draft",
    description: null,
    startedAt: null,
    deliveredAt: null,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    updatedAt: new Date("2026-01-15T10:00:00Z"),
  },
  {
    id: "p-2",
    clientId: "c-beta",
    slug: "refonte-beta",
    name: "Refonte Beta",
    status: "active",
    description: null,
    startedAt: new Date("2026-02-01T09:00:00Z"),
    deliveredAt: null,
    createdAt: new Date("2026-02-01T09:00:00Z"),
    updatedAt: new Date("2026-02-01T09:00:00Z"),
  },
  {
    id: "p-3",
    clientId: "c-unknown",
    slug: "orphan",
    name: "Projet orphelin",
    status: "delivered",
    description: null,
    startedAt: new Date("2025-11-01T09:00:00Z"),
    deliveredAt: new Date("2026-01-01T09:00:00Z"),
    createdAt: new Date("2025-11-01T09:00:00Z"),
    updatedAt: new Date("2026-01-01T09:00:00Z"),
  },
] as Project[];

describe("ProjectsTable", () => {
  it("renders project rows", () => {
    renderWithNuqs(
      <ProjectsTable data={mockProjects} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Site web Acme")).toBeInTheDocument();
    expect(screen.getByText("Refonte Beta")).toBeInTheDocument();
    expect(screen.getByText("Projet orphelin")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    renderWithNuqs(<ProjectsTable data={[]} clientNames={CLIENT_NAMES} />);
    expect(screen.getByText("Aucun résultat trouvé.")).toBeInTheDocument();
  });

  it("displays client names via lookup", () => {
    renderWithNuqs(
      <ProjectsTable data={mockProjects} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta SAS")).toBeInTheDocument();
  });

  it("renders French badge labels for statuses", () => {
    renderWithNuqs(
      <ProjectsTable data={mockProjects} clientNames={CLIENT_NAMES} />,
    );
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText("Livré")).toBeInTheDocument();
  });

  it("shows fallback dash for unknown clientId", () => {
    renderWithNuqs(
      <ProjectsTable data={mockProjects} clientNames={CLIENT_NAMES} />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders delivered status with success badge variant", () => {
    renderWithNuqs(
      <ProjectsTable data={mockProjects} clientNames={CLIENT_NAMES} />,
    );
    const badge = screen.getByText("Livré");
    expect(badge).toHaveAttribute("data-variant", "success");
  });

  it("has search input with correct placeholder and testid", () => {
    renderWithNuqs(
      <ProjectsTable data={mockProjects} clientNames={CLIENT_NAMES} />,
    );
    const input = screen.getByTestId("projects-search");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Rechercher un projet...");
  });
});
