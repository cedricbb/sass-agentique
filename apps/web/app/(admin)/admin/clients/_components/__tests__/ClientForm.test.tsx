// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClientForm } from "../ClientForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateClientAction = vi.fn();
const mockUpdateClientAction = vi.fn();
vi.mock("@/app/actions/clients", () => ({
  createClientAction: (...args: unknown[]) => mockCreateClientAction(...args),
  updateClientAction: (...args: unknown[]) => mockUpdateClientAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function nameInput() {
  return screen.getByRole("textbox", { name: /nom/i });
}

function slugInput() {
  return screen.getByRole("textbox", { name: /slug/i });
}

describe("ClientForm", () => {
  it("render mode create — affiche bouton Créer et champs vides", () => {
    render(<ClientForm />);
    expect(screen.getByRole("button", { name: /créer/i })).toBeInTheDocument();
    expect(nameInput()).toHaveValue("");
    expect(slugInput()).toHaveValue("");
  });

  it("submit mode create — appelle createClientAction avec données valides", async () => {
    mockCreateClientAction.mockResolvedValue({
      ok: true,
      data: { id: "c1", name: "Acme", slug: "acme" },
    });

    render(<ClientForm />);
    fireEvent.change(nameInput(), { target: { value: "Acme" } });
    fireEvent.change(slugInput(), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: /créer/i }));

    await waitFor(() => {
      expect(mockCreateClientAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme", slug: "acme" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/clients");
    });
  });

  it("render mode edit — pré-remplit les champs avec initialData", () => {
    const client = {
      id: "c1",
      name: "Acme",
      slug: "acme",
      type: "company" as const,
      email: "a@b.com",
      phone: "0123456789",
      billingAddress: { line1: "1 rue Test", city: "Paris", zip: "75001", country: "France" },
      notes: "VIP",
    };
    render(<ClientForm initialData={client as never} />);
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Acme");
    expect(slugInput()).toHaveValue("acme");
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("a@b.com");
    expect(screen.getByRole("textbox", { name: /ligne 1/i })).toHaveValue("1 rue Test");
    expect(screen.getByRole("textbox", { name: /ville/i })).toHaveValue("Paris");
  });

  it("submit mode edit — appelle updateClientAction avec id et données", async () => {
    mockUpdateClientAction.mockResolvedValue({ ok: true, data: null });

    const client = {
      id: "c1",
      name: "Acme",
      slug: "acme",
      type: "company" as const,
      email: "",
      phone: null,
      billingAddress: null,
      notes: null,
    };
    render(<ClientForm initialData={client as never} />);
    fireEvent.change(nameInput(), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /mettre à jour/i }));

    await waitFor(() => {
      expect(mockUpdateClientAction).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ name: "New Name" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/clients");
    });
  });

  it("company_type_shows_identity_fields", () => {
    render(<ClientForm />);
    expect(screen.getByTestId("siret-input")).toBeInTheDocument();
    expect(screen.getByTestId("tvaIntra-input")).toBeInTheDocument();
    expect(screen.getByTestId("legalForm-input")).toBeInTheDocument();
  });

  it("individual_type_hides_identity_fields", () => {
    const individualClient = {
      id: "c2",
      name: "Alice",
      slug: "alice",
      type: "individual" as const,
      email: null,
      phone: null,
      billingAddress: null,
      notes: null,
      siret: null,
      tvaIntra: null,
      legalForm: null,
    };
    render(<ClientForm initialData={individualClient as never} />);
    expect(screen.queryByTestId("siret-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tvaIntra-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("legalForm-input")).not.toBeInTheDocument();
  });

  it("individual_submit_strips_identity_fields", async () => {
    mockUpdateClientAction.mockResolvedValue({ ok: true, data: null });

    const individualClient = {
      id: "c2",
      name: "Alice",
      slug: "alice",
      type: "individual" as const,
      email: null,
      phone: null,
      billingAddress: null,
      notes: null,
      siret: null,
      tvaIntra: null,
      legalForm: null,
    };
    render(<ClientForm initialData={individualClient as never} />);
    fireEvent.click(screen.getByRole("button", { name: /mettre à jour/i }));

    await waitFor(() => {
      const callArg = mockUpdateClientAction.mock.calls[0][1] as Record<string, unknown>;
      expect(callArg.siret).toBeUndefined();
      expect(callArg.tvaIntra).toBeUndefined();
      expect(callArg.legalForm).toBeUndefined();
    });
  });

  it("submits_billingAddress_as_structured_object", async () => {
    mockCreateClientAction.mockResolvedValue({ ok: true, data: { id: "c1", name: "X", slug: "x" } });

    render(<ClientForm />);
    fireEvent.change(nameInput(), { target: { value: "X" } });
    fireEvent.change(slugInput(), { target: { value: "x" } });
    fireEvent.change(screen.getByRole("textbox", { name: /ligne 1/i }), { target: { value: "10 rue Test" } });
    fireEvent.change(screen.getByRole("textbox", { name: /ville/i }), { target: { value: "Paris" } });
    fireEvent.click(screen.getByRole("button", { name: /créer/i }));

    await waitFor(() => {
      const callArg = mockCreateClientAction.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty("address");
      expect(typeof callArg.billingAddress).toBe("object");
      expect((callArg.billingAddress as Record<string, string>).line1).toBe("10 rue Test");
      expect((callArg.billingAddress as Record<string, string>).city).toBe("Paris");
    });
  });
});
