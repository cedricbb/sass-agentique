// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteClientButton } from "../DeleteClientButton";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockDeleteClientAction = vi.fn();
vi.mock("@/app/actions/clients", () => ({
  deleteClientAction: (...args: unknown[]) => mockDeleteClientAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

function triggerButton() {
  return screen.getAllByRole("button", { name: /archiver/i })[0];
}

describe("DeleteClientButton", () => {
  it("render — affiche bouton Archiver", () => {
    render(<DeleteClientButton clientId="c1" clientName="Acme" />);
    expect(triggerButton()).toBeInTheDocument();
  });

  it("confirm delete — appelle deleteClientAction avec clientId", async () => {
    mockDeleteClientAction.mockResolvedValue({ ok: true, data: undefined });

    render(<DeleteClientButton clientId="c1" clientName="Acme" />);
    fireEvent.click(triggerButton());
    const confirmButton = await screen.findByRole("button", { name: /archiver/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteClientAction).toHaveBeenCalledWith("c1");
    });
  });

  it("cancel delete — ne déclenche pas deleteClientAction", async () => {
    render(<DeleteClientButton clientId="c1" clientName="Acme" />);
    fireEvent.click(triggerButton());
    const cancelButton = await screen.findByRole("button", { name: /annuler/i });
    fireEvent.click(cancelButton);

    expect(mockDeleteClientAction).not.toHaveBeenCalled();
  });
});
