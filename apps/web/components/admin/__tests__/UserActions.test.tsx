// @vitest-environment jsdom
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/app/actions/admin", () => ({
  banUserAction: vi.fn(),
  unbanUserAction: vi.fn(),
  resetUserTotpAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

import { UserActions } from "../UserActions";
import { banUserAction, unbanUserAction, resetUserTotpAction } from "@/app/actions/admin";
import { toastResult } from "@/lib/toast";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("UserActions", () => {
  it("ban_confirm_calls_action_and_toasts_success", async () => {
    vi.mocked(banUserAction).mockResolvedValue({ ok: true, data: undefined });

    render(<UserActions userId="u-1" isBanned={false} totpEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: /bannir/i }));

    const confirmButton = await screen.findByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(banUserAction).toHaveBeenCalledWith("u-1");
      expect(toastResult).toHaveBeenCalledWith({ ok: true, data: undefined }, "Utilisateur banni");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("unban_confirm_calls_action_and_toasts_success", async () => {
    vi.mocked(unbanUserAction).mockResolvedValue({ ok: true, data: undefined });

    render(<UserActions userId="u-2" isBanned={true} totpEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: /débannir/i }));

    const confirmButton = await screen.findByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(unbanUserAction).toHaveBeenCalledWith("u-2");
      expect(toastResult).toHaveBeenCalledWith({ ok: true, data: undefined }, "Utilisateur débanni");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("action_error_shows_error_toast_no_refresh", async () => {
    vi.mocked(banUserAction).mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Erreur serveur", status: 500 },
    });

    render(<UserActions userId="u-3" isBanned={false} totpEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: /bannir/i }));

    const confirmButton = await screen.findByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toastResult).toHaveBeenCalledWith(
        { ok: false, error: { code: "INTERNAL_ERROR", message: "Erreur serveur", status: 500 } },
        "Utilisateur banni",
      );
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  it("reset_totp_confirm_calls_action_and_toasts_success", async () => {
    vi.mocked(resetUserTotpAction).mockResolvedValue({ ok: true, data: undefined });

    render(<UserActions userId="u-4" isBanned={false} totpEnabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: /reset 2fa/i }));

    const confirmButton = await screen.findByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(resetUserTotpAction).toHaveBeenCalledWith("u-4");
      expect(toastResult).toHaveBeenCalledWith({ ok: true, data: undefined }, "2FA réinitialisé");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
