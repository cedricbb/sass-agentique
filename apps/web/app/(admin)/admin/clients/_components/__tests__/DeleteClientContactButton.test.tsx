// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteClientContactButton } from "../DeleteClientContactButton";

const mockDeleteClientContactAction = vi.fn();
vi.mock("@/app/actions/clients", () => ({
  deleteClientContactAction: (...args: unknown[]) => mockDeleteClientContactAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const defaultProps = {
  contactId: "ct1",
  clientId: "cl1",
  contactName: "Alice",
  hasPortalAccess: false,
};

function deleteTrigger() {
  return screen.getByRole("button", { name: /supprimer le contact/i });
}

describe("DeleteClientContactButton", () => {
  it("render_displays_delete_trigger_button", () => {
    render(<DeleteClientContactButton {...defaultProps} />);
    expect(deleteTrigger()).toBeInTheDocument();
  });

  it("click_trigger_opens_confirmation_dialog", async () => {
    render(<DeleteClientContactButton {...defaultProps} />);
    fireEvent.click(deleteTrigger());
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(await screen.findByText(/supprimer alice/i)).toBeInTheDocument();
  });

  it("portal_access_true_shows_revocation_warning", async () => {
    render(<DeleteClientContactButton {...defaultProps} hasPortalAccess={true} />);
    fireEvent.click(deleteTrigger());
    await screen.findByRole("alertdialog");
    expect(screen.getByText(/accès portail actif/i)).toBeInTheDocument();
    expect(screen.getByText(/révoquera/i)).toBeInTheDocument();
  });

  it("portal_access_false_shows_generic_warning", async () => {
    render(<DeleteClientContactButton {...defaultProps} hasPortalAccess={false} />);
    fireEvent.click(deleteTrigger());
    await screen.findByRole("alertdialog");
    const description = screen.getByText(/définitivement supprimé/i);
    expect(description).toBeInTheDocument();
    expect(description.textContent).not.toMatch(/portail/);
  });

  it("confirm_delete_calls_action_with_correct_args", async () => {
    mockDeleteClientContactAction.mockResolvedValue({ ok: true, data: undefined });
    render(<DeleteClientContactButton {...defaultProps} />);
    fireEvent.click(deleteTrigger());
    const confirmButton = await screen.findByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(mockDeleteClientContactAction).toHaveBeenCalledWith("ct1", "cl1");
    });
  });

  it("cancel_delete_does_not_call_action", async () => {
    render(<DeleteClientContactButton {...defaultProps} />);
    fireEvent.click(deleteTrigger());
    const cancelButton = await screen.findByRole("button", { name: /annuler/i });
    fireEvent.click(cancelButton);
    expect(mockDeleteClientContactAction).not.toHaveBeenCalled();
  });
});
