// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BusinessProfileForm } from "../BusinessProfileForm";
import type { BusinessProfile } from "@saas/db";

const mockUpsertBusinessProfileAction = vi.fn();
vi.mock("@/app/actions/business-profile", () => ({
  upsertBusinessProfileAction: (...args: unknown[]) =>
    mockUpsertBusinessProfileAction(...args),
}));

const mockToastResult = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastResult: (...args: unknown[]) => mockToastResult(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const mockProfile: BusinessProfile = {
  id: "bp-1",
  ownerId: "user-1",
  name: "Acme Corp",
  legalForm: "SAS",
  siret: "12345678901234",
  tvaIntra: "FR12345678901",
  address: {
    line1: "1 rue de la Paix",
    line2: "Bât A",
    city: "Paris",
    state: "Île-de-France",
    zip: "75001",
    country: "France",
  },
  email: "contact@acme.com",
  phone: "0123456789",
  iban: "FR7630006000011234567890189",
  bic: "BNPAFRPP",
  logoKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("BusinessProfileForm", () => {
  it("render_empty_form_shows_all_fields", () => {
    render(<BusinessProfileForm initialProfile={null} />);

    expect(screen.getByRole("textbox", { name: /raison sociale/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /forme juridique/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /siret/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /tva intracommunautaire/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /ligne 1/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /ligne 2/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /code postal/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /ville/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /région/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /pays/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /téléphone/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /iban/i })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /bic/i })).toHaveValue("");
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });

  it("render_with_initial_profile_prefills_fields", () => {
    render(<BusinessProfileForm initialProfile={mockProfile} />);

    expect(screen.getByRole("textbox", { name: /raison sociale/i })).toHaveValue("Acme Corp");
    expect(screen.getByRole("textbox", { name: /siret/i })).toHaveValue("12345678901234");
    expect(screen.getByRole("textbox", { name: /ligne 1/i })).toHaveValue("1 rue de la Paix");
    expect(screen.getByRole("textbox", { name: /ville/i })).toHaveValue("Paris");
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("contact@acme.com");
    expect(screen.getByRole("textbox", { name: /iban/i })).toHaveValue("FR7630006000011234567890189");
  });

  it("submit_calls_upsert_action_and_toasts_success", async () => {
    mockUpsertBusinessProfileAction.mockResolvedValue({ ok: true, data: mockProfile });
    mockToastResult.mockReturnValue(true);

    render(<BusinessProfileForm initialProfile={null} />);

    fireEvent.change(screen.getByRole("textbox", { name: /raison sociale/i }), {
      target: { value: "Acme Corp" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(mockUpsertBusinessProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme Corp" }),
      );
    });
    await waitFor(() => {
      expect(mockToastResult).toHaveBeenCalledWith(
        { ok: true, data: mockProfile },
        "Profil entreprise enregistré",
      );
    });
  });

  it("submit_without_name_blocked_by_validation", async () => {
    render(<BusinessProfileForm initialProfile={null} />);

    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(mockUpsertBusinessProfileAction).not.toHaveBeenCalled();
    });
  });
});
