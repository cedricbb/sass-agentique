// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditClientContactDialog } from "../EditClientContactDialog";

Element.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockUpdateClientContactAction = vi.fn();
vi.mock("@/app/actions/clients", () => ({
  updateClientContactAction: (...args: unknown[]) => mockUpdateClientContactAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const defaultContact = { id: "ct1", name: "Alice", email: "alice@test.com", role: null };
const defaultProps = { contact: defaultContact, clientId: "cl1" };

function editTrigger() {
  return screen.getByRole("button", { name: /modifier le contact/i });
}

describe("EditClientContactDialog", () => {
  it("render_displays_edit_trigger_button", () => {
    render(<EditClientContactDialog {...defaultProps} />);
    expect(editTrigger()).toBeInTheDocument();
  });

  it("open_dialog_shows_prefilled_name_and_email", async () => {
    render(<EditClientContactDialog {...defaultProps} />);
    fireEvent.click(editTrigger());
    const nameInput = await screen.findByDisplayValue("Alice");
    const emailInput = await screen.findByDisplayValue("alice@test.com");
    expect(nameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
  });

  it("prefills_predefined_role_in_select", async () => {
    render(
      <EditClientContactDialog contact={{ ...defaultContact, role: "Décideur" }} clientId="cl1" />,
    );
    fireEvent.click(editTrigger());
    await screen.findByDisplayValue("Alice");
    expect(
      screen.getByText("Décideur", { selector: '[data-slot="select-value"]' }),
    ).toBeInTheDocument();
  });

  it("prefills_custom_role_with_autre_selected", async () => {
    render(
      <EditClientContactDialog contact={{ ...defaultContact, role: "CEO" }} clientId="cl1" />,
    );
    fireEvent.click(editTrigger());
    await screen.findByDisplayValue("Alice");
    expect(
      screen.getByText("Autre", { selector: '[data-slot="select-value"]' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("CEO")).toBeInTheDocument();
  });

  it("shows_placeholder_when_role_is_null", async () => {
    render(<EditClientContactDialog {...defaultProps} />);
    fireEvent.click(editTrigger());
    await screen.findByDisplayValue("Alice");
    expect(screen.getByText("Sélectionner un rôle (optionnel)")).toBeInTheDocument();
  });

  it("submit_calls_update_action_with_correct_args", async () => {
    mockUpdateClientContactAction.mockResolvedValue({ ok: true, data: null });
    render(<EditClientContactDialog {...defaultProps} />);
    fireEvent.click(editTrigger());
    const submitButton = await screen.findByRole("button", { name: /enregistrer/i });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockUpdateClientContactAction).toHaveBeenCalledWith("ct1", "cl1", {
        name: "Alice",
        email: "alice@test.com",
        role: null,
      });
    });
  });
});
