// @vitest-environment jsdom
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/utils", () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(" ") }));
vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button>Déconnexion</button>,
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <div data-testid="avatar">{children}</div>,
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span data-testid="avatar-fallback">{children}</span>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div data-testid="dropdown-label">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <div data-testid="dropdown-item">{children}</div>,
}));

import { AdminUserMenuDropdown, getAdminInitials } from "../AdminUserMenuDropdown";

describe("getAdminInitials", () => {
  it("renders_avatar_initials_two_words", () => {
    expect(getAdminInitials("Cédric Bb", "any@example.com")).toBe("CB");
  });

  it("renders_avatar_initials_single_word", () => {
    expect(getAdminInitials("Jean", "any@example.com")).toBe("J");
  });

  it("renders_avatar_initials_no_name", () => {
    expect(getAdminInitials(null, "admin@saas.dev")).toBe("A");
  });
});

describe("AdminUserMenuDropdown", () => {
  it("renders_email_and_logout_in_dropdown", () => {
    render(<AdminUserMenuDropdown user={{ name: "Cédric Bb", email: "cedric@saas.dev" }} />);
    expect(screen.getByTestId("avatar-fallback").textContent).toBe("CB");
    expect(screen.getAllByText("cedric@saas.dev").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Déconnexion")).toBeTruthy();
  });
});
