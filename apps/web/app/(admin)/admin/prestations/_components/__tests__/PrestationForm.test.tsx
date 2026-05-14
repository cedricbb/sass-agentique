// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/actions/prestations", () => ({
  createPrestationAction: vi.fn(),
  updatePrestationAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

import { PrestationForm } from "../PrestationForm";
import {
  createPrestationAction,
  updatePrestationAction,
} from "@/app/actions/prestations";
import type { Prestation } from "@saas/db";

const mockPrestation: Prestation = {
  id: "p-1",
  slug: "dev-web",
  name: "Dev web",
  description: "Site web complet",
  basePriceEurCents: 5000,
  kind: "one_shot",
  stripeProductId: null,
  stripePriceId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Prestation;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("PrestationForm", () => {
  it("F1 — mode create : champs vides + bouton Créer", () => {
    render(<PrestationForm />);
    expect(screen.getByTestId("prestation-name-input")).toHaveValue("");
    expect(screen.getByTestId("prestation-slug-input")).toHaveValue("");
    expect(screen.getByRole("button", { name: /créer/i })).toBeInTheDocument();
  });

  it("F2 — mode edit : pré-remplissage avec conversion cents→euros", () => {
    render(<PrestationForm initialData={mockPrestation} />);
    expect(screen.getByTestId("prestation-name-input")).toHaveValue("Dev web");
    expect(screen.getByTestId("prestation-slug-input")).toHaveValue("dev-web");
    expect(screen.getByTestId("prestation-baseprice-input")).toHaveValue(50);
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });

  it("F3 — submit create → createPrestationAction + redirect", async () => {
    vi.mocked(createPrestationAction).mockResolvedValue({ ok: true, data: null } as never);

    render(<PrestationForm />);
    fireEvent.change(screen.getByTestId("prestation-name-input"), {
      target: { value: "Nouveau service" },
    });
    fireEvent.click(screen.getByTestId("prestation-form-submit"));

    await waitFor(() => {
      expect(createPrestationAction).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/prestations");
    });
  });

  it("F4 — submit edit → updatePrestationAction(id, ...) + redirect", async () => {
    vi.mocked(updatePrestationAction).mockResolvedValue({ ok: true, data: null } as never);

    render(<PrestationForm initialData={mockPrestation} />);
    fireEvent.click(screen.getByTestId("prestation-form-submit"));

    await waitFor(() => {
      expect(updatePrestationAction).toHaveBeenCalledWith("p-1", expect.any(Object));
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/prestations");
    });
  });

  it("F5 — ArchivePrestationButton visible en mode edit, absent en create", () => {
    const { rerender } = render(<PrestationForm />);
    expect(screen.queryByTestId("archive-prestation-trigger")).not.toBeInTheDocument();

    rerender(<PrestationForm initialData={mockPrestation} />);
    expect(screen.getByTestId("archive-prestation-trigger")).toBeInTheDocument();
  });
});
