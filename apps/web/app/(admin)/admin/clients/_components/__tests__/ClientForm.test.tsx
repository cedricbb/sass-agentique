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
      address: "1 rue Test",
      notes: "VIP",
    };
    render(<ClientForm initialData={client as never} />);
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Acme");
    expect(slugInput()).toHaveValue("acme");
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("a@b.com");
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
      address: null,
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
});
