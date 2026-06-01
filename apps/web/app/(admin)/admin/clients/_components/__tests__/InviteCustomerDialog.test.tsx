// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteCustomerDialog } from "../InviteCustomerDialog";

const mockInviteCustomerAction = vi.fn();
vi.mock("@/app/actions/clients", () => ({
  inviteCustomerAction: (...args: unknown[]) => mockInviteCustomerAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

const DEFAULT_PROPS = {
  clientId: "123e4567-e89b-12d3-a456-426614174001",
  contactId: "123e4567-e89b-12d3-a456-426614174002",
  contactName: "Alice Dupont",
  contactEmail: "alice@example.com",
  hasActiveInvitation: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInviteCustomerAction.mockResolvedValue({ ok: true, data: { expiresAt: new Date() } });
});

afterEach(cleanup);

describe("InviteCustomerDialog", () => {
  it("InviteCustomerDialog — renders invite title when no active invitation", async () => {
    render(<InviteCustomerDialog {...DEFAULT_PROPS} hasActiveInvitation={false} />);
    fireEvent.click(screen.getByRole("button", { name: /inviter au portail/i }));
    const title = await screen.findByText(/inviter alice dupont au portail client/i);
    expect(title).toBeInTheDocument();
  });

  it("InviteCustomerDialog — renders resend title when active invitation", async () => {
    render(
      <InviteCustomerDialog
        {...DEFAULT_PROPS}
        hasActiveInvitation={true}
        activeExpiresAt={new Date()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /renvoyer l'invitation/i }));
    const title = await screen.findByText(/renvoyer l'invitation à alice dupont/i);
    expect(title).toBeInTheDocument();
  });

  it("InviteCustomerDialog — calls inviteCustomerAction on confirm", async () => {
    render(<InviteCustomerDialog {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /inviter au portail/i }));
    const confirmButton = await screen.findByRole("button", { name: /envoyer l'invitation/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockInviteCustomerAction).toHaveBeenCalledWith(
        DEFAULT_PROPS.clientId,
        DEFAULT_PROPS.contactId,
      );
    });
  });

  it("InviteCustomerDialog — does not call action on cancel", async () => {
    render(<InviteCustomerDialog {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /inviter au portail/i }));
    const cancelButton = await screen.findByRole("button", { name: /annuler/i });
    fireEvent.click(cancelButton);

    expect(mockInviteCustomerAction).not.toHaveBeenCalled();
  });
});
