// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/actions/projects", () => ({
  createProjectAction: vi.fn(),
  updateProjectAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

import { ProjectForm } from "../ProjectForm";
import {
  createProjectAction,
  updateProjectAction,
} from "@/app/actions/projects";
import type { Project, Client } from "@saas/db";

const mockClients: Client[] = [
  {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Acme Corp",
    slug: "acme-corp",
    type: "company",
    email: "acme@example.com",
    phone: null,
    billingAddress: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    name: "Beta Inc",
    slug: "beta-inc",
    type: "company",
    email: "beta@example.com",
    phone: null,
    billingAddress: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

const mockProject: Project = {
  id: "p-1",
  clientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "Site Acme",
  slug: "site-acme",
  status: "draft",
  description: "A website",
  startedAt: null,
  deliveredAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("ProjectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("F1 — mode create: champs vides + bouton Créer", () => {
    render(<ProjectForm clients={mockClients} />);

    expect(screen.getByTestId("project-name-input")).toHaveValue("");
    expect(screen.getByTestId("project-slug-input")).toHaveValue("");
    expect(screen.getByTestId("project-description-input")).toHaveValue("");
    expect(screen.getByTestId("project-form-submit")).toHaveTextContent("Créer");
  });

  it("F2 — mode edit: pré-rempli + bouton Enregistrer", () => {
    render(<ProjectForm initialData={mockProject} clients={mockClients} />);

    expect(screen.getByTestId("project-name-input")).toHaveValue("Site Acme");
    expect(screen.getByTestId("project-slug-input")).toHaveValue("site-acme");
    expect(screen.getByTestId("project-description-input")).toHaveValue("A website");
    expect(screen.getByTestId("project-client-select")).toHaveTextContent("Acme Corp");
    expect(screen.getByTestId("project-form-submit")).toHaveTextContent("Enregistrer");
  });

  it("F3 — submit vide → validation zod → action NON appelée", async () => {
    render(<ProjectForm clients={mockClients} />);
    fireEvent.click(screen.getByTestId("project-form-submit"));

    await waitFor(() => {
      expect(createProjectAction).not.toHaveBeenCalled();
    });
  });

  it("F4 — submit edit → updateProjectAction(id, values) + redirect", async () => {
    vi.mocked(updateProjectAction).mockResolvedValue({ ok: true, data: mockProject });
    render(<ProjectForm initialData={mockProject} clients={mockClients} />);

    fireEvent.click(screen.getByTestId("project-form-submit"));

    await waitFor(() => {
      expect(updateProjectAction).toHaveBeenCalledWith("p-1", expect.any(Object));
      expect(mockPush).toHaveBeenCalledWith("/admin/projects");
    });
  });
});
